import type { FeFacturaEstado, PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeFacturaRepository } from "../repositories/fe-factura.repository";
import { FeNotaRepository } from "../repositories/fe-nota.repository";
import { FeFacturaCompraRepository } from "../repositories/fe-factura-compra.repository";
import { FeReciboPagoRepository } from "../repositories/fe-recibo-pago.repository";
import { FeMensajeReceptorRepository } from "../repositories/fe-mensaje-receptor.repository";
import { FeContabilidadService } from "./fe-contabilidad.service";
import { FeJobQueueRepository } from "../repositories/fe-job-queue.repository";
import type { FeDocumentKind } from "../validators/nota.schema";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeComprobanteService } from "./comprobante.service";
import { FeTrazabilidadService } from "./fe-trazabilidad.service";
import { feConsultaEstadoService } from "./hacienda/consulta-estado.service";
import { feEnvioHaciendaService, type FeEnvioHaciendaResult } from "./hacienda/envio-hacienda.service";
import { feTokenHaciendaService } from "./hacienda/token-hacienda.service";
import { feFirmaDigitalService } from "./firma/firma-digital.service";
import { FeXmlService } from "./xml/xml.service";
import { feLogger } from "../utils/logger";
import { notDeleted } from "../utils/soft-delete";
import { resolveAtvPasswordEncForToken } from "../utils/fe-atv-usuario";
import { FeComprobanteEntregaService } from "./comprobante-entrega.service";
import { buildNotaReferenciaSnapshot } from "../utils/fe-nota-referencia";
import { validateFeV44Factura, validateFeV44FacturaCompra, validateFeV44ReciboPago } from "../validators/fe-v44-validator";
import { validateFeXmlXsdOptional } from "../validators/fe-xsd-validator";
import { summarizeHaciendaConsultaRaw } from "../utils/hacienda-respuesta-xml";

type EmpresaCertFields = {
  ambiente?: string | null;
  certificadoPath?: string | null;
  certificadoPasswordEnc?: string | null;
  certificadoPathStg?: string | null;
  certificadoPasswordEncStg?: string | null;
};

function resolveCertForAmbiente(empresa: EmpresaCertFields): {
  certPath: string | null;
  certPasswordEnc: string | null;
} {
  const isStaging = empresa.ambiente === "STAGING";
  const certPath = isStaging
    ? (empresa.certificadoPathStg ?? empresa.certificadoPath ?? null)
    : (empresa.certificadoPath ?? null);
  const certPasswordEnc = isStaging
    ? (empresa.certificadoPasswordEncStg ?? empresa.certificadoPasswordEnc ?? null)
    : (empresa.certificadoPasswordEnc ?? null);
  return { certPath, certPasswordEnc };
}

/**
 * Orquesta el flujo de emisión: XML → firma → PDF → token → envío → consulta → correo.
 */
export class FeEmisionOrchestratorService {
  private readonly facturaRepo: FeFacturaRepository;
  private readonly notaRepo: FeNotaRepository;
  private readonly mensajeRepo: FeMensajeReceptorRepository;
  private readonly compraRepo: FeFacturaCompraRepository;
  private readonly reciboRepo: FeReciboPagoRepository;
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly jobRepo: FeJobQueueRepository;
  private readonly comprobanteService: FeComprobanteService;
  private readonly xmlService: FeXmlService;
  private readonly trazabilidad: FeTrazabilidadService;
  private readonly entrega: FeComprobanteEntregaService;
  private readonly contabilidad: FeContabilidadService;

  constructor(private readonly prisma: PrismaClient) {
    this.facturaRepo = new FeFacturaRepository(prisma);
    this.notaRepo = new FeNotaRepository(prisma);
    this.mensajeRepo = new FeMensajeReceptorRepository(prisma);
    this.compraRepo = new FeFacturaCompraRepository(prisma);
    this.reciboRepo = new FeReciboPagoRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.jobRepo = new FeJobQueueRepository(prisma);
    this.comprobanteService = new FeComprobanteService(prisma);
    this.xmlService = new FeXmlService(prisma);
    this.trazabilidad = new FeTrazabilidadService(prisma);
    this.entrega = new FeComprobanteEntregaService(prisma);
    this.contabilidad = new FeContabilidadService(prisma);
  }

  async encolarEnvio(companyCode: string, facturaId: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const factura = await this.facturaRepo.findById(facturaId, empresa.id);

    if (factura.estado !== "BORRADOR" && factura.estado !== "ERROR") {
      throw new FeDomainError("La factura no está en estado enviable", "FE_ESTADO_NO_ENVIABLE");
    }

    this.assertEmisorListo(empresa);

    if (!factura.comprobanteId) {
      await this.comprobanteService.reservarFacturaElectronica({
        facturaId,
        empresaId: empresa.id,
        puntoVentaId: factura.puntoVentaId,
        cedulaJuridica: empresa.cedulaJuridica,
        claveSituacion: empresa.claveSituacion,
        ambiente: empresa.ambiente,
        fechaEmision: new Date(),
        userId,
      });
    }

    await this.facturaRepo.updateEstado(facturaId, "PENDIENTE_ENVIO", userId);
    await this.jobRepo.enqueue({
      jobType: "REINTENTO_ENVIO",
      empresaId: empresa.id,
      payload: { facturaId, companyCode },
    });

    feLogger.info("Envío FE encolado", { facturaId, companyCode });
    return { facturaId, estado: "PENDIENTE_ENVIO" as const };
  }

  async procesarEnvioFactura(facturaId: string, companyCode: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    this.assertEmisorListo(empresa);

    let factura = await this.prisma.feFactura.findFirst({
      where: { id: facturaId, empresaId: empresa.id, ...notDeleted },
      include: { cliente: true, comprobante: true },
    });

    if (!factura) {
      throw new FeDomainError("Factura no encontrada", "FE_FACTURA_NOT_FOUND", 404);
    }

    if (["ACEPTADA", "ACEPTADA_PARCIALMENTE", "RECHAZADA", "ANULADA"].includes(factura.estado)) {
      return { facturaId, estado: factura.estado };
    }

    if (factura.estado === "ENVIADA" && factura.comprobante) {
      return this.consultarEstadoFactura(facturaId, companyCode);
    }

    if (factura.estado !== "BORRADOR" && factura.estado !== "ERROR" && factura.estado !== "PENDIENTE_ENVIO") {
      throw new FeDomainError("La factura no está en estado enviable", "FE_ESTADO_NO_ENVIABLE");
    }

    if (!factura.comprobanteId) {
      await this.comprobanteService.reservarFacturaElectronica({
        facturaId,
        empresaId: empresa.id,
        puntoVentaId: factura.puntoVentaId,
        cedulaJuridica: empresa.cedulaJuridica,
        claveSituacion: empresa.claveSituacion,
        ambiente: empresa.ambiente,
        fechaEmision: new Date(),
        userId,
      });
      factura = await this.prisma.feFactura.findFirstOrThrow({
        where: { id: facturaId },
        include: { cliente: true, comprobante: true },
      });
    }

    await this.facturaRepo.updateEstado(facturaId, "PENDIENTE_ENVIO", userId);

    if (!factura.comprobante) {
      throw new FeDomainError("Factura sin comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    const retryFromError = factura.estado === "ERROR";
    const comprobanteId = factura.comprobante.id;
    let comprobante = factura.comprobante;

    const detalles = await this.prisma.feFacturaDetalle.findMany({
      where: { facturaId, ...notDeleted },
      orderBy: { numeroLinea: "asc" },
    });
    validateFeV44Factura({ empresa, cliente: factura.cliente, factura, detalles });

    try {
      // 1. XML sin firma
      let xmlSinFirma: string;
      if (comprobante.xmlSinFirmaPath) {
        xmlSinFirma = await this.xmlService.readXmlFromStorage(comprobante.xmlSinFirmaPath);
      } else {
        const built = await this.xmlService.buildAndPersistFacturaXml(facturaId, companyCode);
        xmlSinFirma = built.xml;
        validateFeXmlXsdOptional(xmlSinFirma, comprobante.tipo);
        comprobante = (await this.prisma.feComprobanteElectronico.findUniqueOrThrow({
          where: { id: comprobanteId },
        }))!;
        await this.trazabilidad.log({
          comprobanteId,
          operacion: "GENERAR_XML",
          resultado: "EXITO",
          responseMeta: { path: built.relativePath },
        });
      }

      // 2. Firma digital
      let xmlFirmado: string;
      if (comprobante.xmlFirmadoPath && !retryFromError) {
        xmlFirmado = await this.xmlService.readXmlFromStorage(comprobante.xmlFirmadoPath);
      } else {
        const { certPath, certPasswordEnc } = resolveCertForAmbiente(empresa);
        if (!certPath || !certPasswordEnc) {
          const label = empresa.ambiente === "STAGING" ? "pruebas (Staging)" : "producción";
          throw new FeDomainError(`Certificado digital (${label}) no configurado`, "FE_CERTIFICADO_REQUERIDO");
        }
        const signed = await feFirmaDigitalService.firmarXmlFromP12({
          companyCode,
          comprobanteId,
          claveNumerica: comprobante.claveNumerica,
          p12RelativePath: certPath,
          p12PasswordEnc: certPasswordEnc,
          xml: xmlSinFirma,
          comprobanteTipo: comprobante.tipo,
        });
        xmlFirmado = signed.xmlFirmado;
        await this.prisma.feComprobanteElectronico.update({
          where: { id: comprobanteId },
          data: { xmlFirmadoPath: signed.relativePath },
        });
        await this.trazabilidad.log({
          comprobanteId,
          operacion: "FIRMAR_XML",
          resultado: "EXITO",
          responseMeta: { path: signed.relativePath },
        });
      }

      // 2b. PDF representación (no bloquea envío si falla)
      try {
        await this.entrega.asegurarPdfFactura(facturaId, companyCode);
      } catch (pdfErr) {
        feLogger.warn("PDF FE no generado", {
          facturaId,
          error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        });
      }

      // 3. Token Hacienda
      const tokenStarted = Date.now();
      const token = await feTokenHaciendaService.obtenerToken(empresa);
      await this.trazabilidad.log({
        comprobanteId,
        operacion: "OBTENER_TOKEN",
        resultado: "EXITO",
        duracionMs: Date.now() - tokenStarted,
      });

      // 4. Envío a Hacienda
      const envioStarted = Date.now();
      const envio = await feEnvioHaciendaService.enviarComprobante({
        ambiente: empresa.ambiente,
        token,
        clave: comprobante.claveNumerica,
        fechaEmision: comprobante.fechaEmision,
        emisorTipo: empresa.tipoIdentificacion ?? "JURIDICA",
        emisorIdentificacion: empresa.cedulaJuridica,
        ...(factura.cliente
          ? {
              receptorTipo: factura.cliente.tipoIdentificacion,
              receptorIdentificacion: factura.cliente.identificacion,
            }
          : {}),
        xmlFirmado,
      });

      return this.finalizarEnvioHacienda({
        envio,
        envioStarted,
        comprobanteId,
        documentKind: "factura",
        documentId: facturaId,
        companyCode,
        empresaId: empresa.id,
        userId,
        updateEstado: (estado) => this.facturaRepo.updateEstado(facturaId, estado, userId),
        returnKey: "facturaId",
        returnId: facturaId,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.trazabilidad.log({
        comprobanteId,
        operacion: "ERROR",
        resultado: "ERROR",
        errorMessage: message,
      });
      await this.facturaRepo.updateEstado(facturaId, "ERROR");
      await this.trazabilidad.registrarEstadoHacienda({
        comprobanteId,
        estado: "ERROR",
        mensaje: message,
      });
      throw e;
    }
  }

  async consultarEstadoFactura(facturaId: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const factura = await this.facturaRepo.findById(facturaId, empresa.id);
    if (!factura.comprobante) {
      throw new FeDomainError("Factura sin comprobante", "FE_SIN_COMPROBANTE");
    }

    return this.consultarEstadoComprobante({
      documentKind: "factura",
      documentId: facturaId,
      comprobanteId: factura.comprobante.id,
      clave: factura.comprobante.claveNumerica,
      companyCode,
      empresa,
    });
  }

  async procesarEnvioNotaCredito(notaId: string, companyCode: string, userId?: string) {
    return this.procesarEnvioNota("NOTA_CREDITO", notaId, companyCode, userId);
  }

  async procesarEnvioNotaDebito(notaId: string, companyCode: string, userId?: string) {
    return this.procesarEnvioNota("NOTA_DEBITO", notaId, companyCode, userId);
  }

  private async procesarEnvioNota(
    tipo: "NOTA_CREDITO" | "NOTA_DEBITO",
    notaId: string,
    companyCode: string,
    userId?: string
  ) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    this.assertEmisorListo(empresa);
    const documentKind: FeDocumentKind = tipo === "NOTA_CREDITO" ? "nota_credito" : "nota_debito";

    const loadNota = () =>
      tipo === "NOTA_CREDITO"
        ? this.notaRepo.findCreditoById(notaId, empresa.id)
        : this.notaRepo.findDebitoById(notaId, empresa.id);

    let nota = await loadNota();
    const referencia = buildNotaReferenciaSnapshot(nota);
    const receptor = referencia.receptor;

    if (["ACEPTADA", "ACEPTADA_PARCIALMENTE", "RECHAZADA", "ANULADA"].includes(nota.estado)) {
      return { notaId, estado: nota.estado };
    }

    if (nota.estado === "ENVIADA" && nota.comprobante) {
      return this.consultarEstadoDocumento(documentKind, notaId, companyCode);
    }

    if (nota.estado !== "BORRADOR" && nota.estado !== "ERROR" && nota.estado !== "PENDIENTE_ENVIO") {
      throw new FeDomainError("La nota no está en estado enviable", "FE_ESTADO_NO_ENVIABLE");
    }

    if (!nota.comprobanteId) {
      await this.comprobanteService.reservarNotaComprobante({
        tipo,
        notaId,
        empresaId: empresa.id,
        puntoVentaId: referencia.puntoVentaId,
        cedulaJuridica: empresa.cedulaJuridica,
        claveSituacion: empresa.claveSituacion,
        ambiente: empresa.ambiente,
        fechaEmision: new Date(),
        userId,
      });
      nota = await loadNota();
    }

    await this.updateDocumentoEstado(documentKind, notaId, "PENDIENTE_ENVIO", userId);

    if (!nota.comprobante) {
      throw new FeDomainError("Nota sin comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    const retryFromError = nota.estado === "ERROR";
    const comprobanteId = nota.comprobante.id;
    let comprobante = nota.comprobante;

    try {
      let xmlSinFirma: string;
      if (comprobante.xmlSinFirmaPath) {
        xmlSinFirma = await this.xmlService.readXmlFromStorage(comprobante.xmlSinFirmaPath);
      } else {
        const built =
          tipo === "NOTA_CREDITO"
            ? await this.xmlService.buildAndPersistNotaCreditoXml(notaId, companyCode)
            : await this.xmlService.buildAndPersistNotaDebitoXml(notaId, companyCode);
        xmlSinFirma = built.xml;
        validateFeXmlXsdOptional(xmlSinFirma, comprobante.tipo);
        comprobante = await this.prisma.feComprobanteElectronico.findUniqueOrThrow({
          where: { id: comprobanteId },
        });
        await this.trazabilidad.log({
          comprobanteId,
          operacion: "GENERAR_XML",
          resultado: "EXITO",
          responseMeta: { path: built.relativePath },
        });
      }

      let xmlFirmado: string;
      if (comprobante.xmlFirmadoPath && !retryFromError) {
        xmlFirmado = await this.xmlService.readXmlFromStorage(comprobante.xmlFirmadoPath);
      } else {
        const { certPath: certPath2, certPasswordEnc: certPasswordEnc2 } = resolveCertForAmbiente(empresa);
        if (!certPath2 || !certPasswordEnc2) {
          const label2 = empresa.ambiente === "STAGING" ? "pruebas (Staging)" : "producción";
          throw new FeDomainError(`Certificado digital (${label2}) no configurado`, "FE_CERTIFICADO_REQUERIDO");
        }
        const signed = await feFirmaDigitalService.firmarXmlFromP12({
          companyCode,
          comprobanteId,
          claveNumerica: comprobante.claveNumerica,
          p12RelativePath: certPath2,
          p12PasswordEnc: certPasswordEnc2,
          xml: xmlSinFirma,
          comprobanteTipo: comprobante.tipo,
        });
        xmlFirmado = signed.xmlFirmado;
        await this.prisma.feComprobanteElectronico.update({
          where: { id: comprobanteId },
          data: { xmlFirmadoPath: signed.relativePath },
        });
        await this.trazabilidad.log({
          comprobanteId,
          operacion: "FIRMAR_XML",
          resultado: "EXITO",
          responseMeta: { path: signed.relativePath },
        });
      }

      try {
        await this.entrega.asegurarPdfNota(documentKind, notaId, companyCode);
      } catch (pdfErr) {
        feLogger.warn("PDF nota FE no generado", {
          notaId,
          error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        });
      }

      const tokenStarted = Date.now();
      const token = await feTokenHaciendaService.obtenerToken(empresa);
      await this.trazabilidad.log({
        comprobanteId,
        operacion: "OBTENER_TOKEN",
        resultado: "EXITO",
        duracionMs: Date.now() - tokenStarted,
      });

      const envioStarted = Date.now();
      const envio = await feEnvioHaciendaService.enviarComprobante({
        ambiente: empresa.ambiente,
        token,
        clave: comprobante.claveNumerica,
        fechaEmision: comprobante.fechaEmision,
        emisorTipo: "JURIDICA",
        emisorIdentificacion: empresa.cedulaJuridica,
        ...(receptor
          ? {
              receptorTipo: receptor.tipoIdentificacion,
              receptorIdentificacion: receptor.identificacion,
            }
          : {}),
        xmlFirmado,
      });

      return this.finalizarEnvioHacienda({
        envio,
        envioStarted,
        comprobanteId,
        documentKind,
        documentId: notaId,
        companyCode,
        empresaId: empresa.id,
        userId,
        updateEstado: (estado) => this.updateDocumentoEstado(documentKind, notaId, estado, userId),
        returnKey: "notaId",
        returnId: notaId,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.trazabilidad.log({
        comprobanteId,
        operacion: "ERROR",
        resultado: "ERROR",
        errorMessage: message,
      });
      await this.updateDocumentoEstado(documentKind, notaId, "ERROR", userId);
      await this.trazabilidad.registrarEstadoHacienda({
        comprobanteId,
        estado: "ERROR",
        mensaje: message,
      });
      throw e;
    }
  }

  async procesarEnvioMensajeReceptor(mensajeId: string, companyCode: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    this.assertEmisorListo(empresa);
    const documentKind: FeDocumentKind = "mensaje_receptor";

    let mensaje = await this.mensajeRepo.findById(mensajeId, empresa.id);

    if (["ACEPTADA", "ACEPTADA_PARCIALMENTE", "RECHAZADA", "ANULADA"].includes(mensaje.estado)) {
      return { mensajeId, estado: mensaje.estado };
    }

    if (mensaje.estado === "ENVIADA" && mensaje.comprobante) {
      return this.consultarEstadoDocumento(documentKind, mensajeId, companyCode);
    }

    if (mensaje.estado !== "BORRADOR" && mensaje.estado !== "ERROR" && mensaje.estado !== "PENDIENTE_ENVIO") {
      throw new FeDomainError("El mensaje no está en estado enviable", "FE_ESTADO_NO_ENVIABLE");
    }

    if (!mensaje.comprobanteId) {
      await this.comprobanteService.reservarMensajeReceptorComprobante({
        mensajeId,
        empresaId: empresa.id,
        puntoVentaId: mensaje.puntoVentaId,
        cedulaJuridica: empresa.cedulaJuridica,
        claveSituacion: empresa.claveSituacion,
        ambiente: empresa.ambiente,
        fechaEmision: new Date(),
        userId,
      });
      mensaje = await this.mensajeRepo.findById(mensajeId, empresa.id);
    }

    await this.updateDocumentoEstado(documentKind, mensajeId, "PENDIENTE_ENVIO", userId);

    if (!mensaje.comprobante) {
      throw new FeDomainError("Mensaje sin comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    const retryFromError = mensaje.estado === "ERROR";
    const comprobanteId = mensaje.comprobante.id;
    let comprobante = mensaje.comprobante;
    const receptorTipo = mensaje.cedulaEmisor.replace(/\D/g, "").length === 10 ? "JURIDICA" : "FISICA";

    try {
      let xmlSinFirma: string;
      if (comprobante.xmlSinFirmaPath) {
        xmlSinFirma = await this.xmlService.readXmlFromStorage(comprobante.xmlSinFirmaPath);
      } else {
        const built = await this.xmlService.buildAndPersistMensajeReceptorXml(mensajeId, companyCode);
        xmlSinFirma = built.xml;
        comprobante = await this.prisma.feComprobanteElectronico.findUniqueOrThrow({
          where: { id: comprobanteId },
        });
        await this.trazabilidad.log({
          comprobanteId,
          operacion: "GENERAR_XML",
          resultado: "EXITO",
          responseMeta: { path: built.relativePath },
        });
      }

      let xmlFirmado: string;
      if (comprobante.xmlFirmadoPath && !retryFromError) {
        xmlFirmado = await this.xmlService.readXmlFromStorage(comprobante.xmlFirmadoPath);
      } else {
        const { certPath: certPath3, certPasswordEnc: certPasswordEnc3 } = resolveCertForAmbiente(empresa);
        const signed = await feFirmaDigitalService.firmarXmlFromP12({
          companyCode,
          comprobanteId,
          claveNumerica: comprobante.claveNumerica,
          p12RelativePath: certPath3!,
          p12PasswordEnc: certPasswordEnc3!,
          xml: xmlSinFirma,
          comprobanteTipo: comprobante.tipo,
        });
        xmlFirmado = signed.xmlFirmado;
        await this.prisma.feComprobanteElectronico.update({
          where: { id: comprobanteId },
          data: { xmlFirmadoPath: signed.relativePath },
        });
        await this.trazabilidad.log({
          comprobanteId,
          operacion: "FIRMAR_XML",
          resultado: "EXITO",
          responseMeta: { path: signed.relativePath },
        });
      }

      const token = await feTokenHaciendaService.obtenerToken(empresa);
      const envioStarted = Date.now();
      const envio = await feEnvioHaciendaService.enviarComprobante({
        ambiente: empresa.ambiente,
        token,
        clave: comprobante.claveNumerica,
        fechaEmision: comprobante.fechaEmision,
        emisorTipo: "JURIDICA",
        emisorIdentificacion: empresa.cedulaJuridica,
        receptorTipo,
        receptorIdentificacion: mensaje.cedulaEmisor,
        xmlFirmado,
      });

      return this.finalizarEnvioHacienda({
        envio,
        envioStarted,
        comprobanteId,
        documentKind,
        documentId: mensajeId,
        companyCode,
        empresaId: empresa.id,
        userId,
        updateEstado: (estado) => this.updateDocumentoEstado(documentKind, mensajeId, estado, userId),
        returnKey: "mensajeId",
        returnId: mensajeId,
        receivedMessage: "Mensaje receptor recibido por Hacienda",
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.trazabilidad.log({
        comprobanteId,
        operacion: "ERROR",
        resultado: "ERROR",
        errorMessage: message,
      });
      await this.updateDocumentoEstado(documentKind, mensajeId, "ERROR", userId);
      throw e;
    }
  }

  async encolarEnvioFacturaCompra(companyCode: string, id: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.compraRepo.findById(id, empresa.id);
    if (doc.estado !== "BORRADOR" && doc.estado !== "ERROR") {
      throw new FeDomainError("Documento no enviable", "FE_ESTADO_NO_ENVIABLE");
    }
    this.assertEmisorListo(empresa);
    if (!doc.comprobanteId) {
      await this.comprobanteService.reservarFacturaCompra({
        facturaCompraId: id,
        empresaId: empresa.id,
        puntoVentaId: doc.puntoVentaId,
        cedulaJuridica: empresa.cedulaJuridica,
        claveSituacion: empresa.claveSituacion,
        ambiente: empresa.ambiente,
        fechaEmision: doc.fecha,
        userId,
      });
    }
    await this.compraRepo.updateEstado(id, "PENDIENTE_ENVIO", userId);
    await this.jobRepo.enqueue({
      jobType: "REINTENTO_ENVIO",
      empresaId: empresa.id,
      payload: { facturaCompraId: id, companyCode, documentKind: "factura_compra" },
    });
    return { id, estado: "PENDIENTE_ENVIO" as const };
  }

  async encolarEnvioReciboPago(companyCode: string, id: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.reciboRepo.findById(id, empresa.id);
    if (doc.estado !== "BORRADOR" && doc.estado !== "ERROR") {
      throw new FeDomainError("Documento no enviable", "FE_ESTADO_NO_ENVIABLE");
    }
    this.assertEmisorListo(empresa);
    if (!doc.comprobanteId) {
      await this.comprobanteService.reservarReciboPago({
        reciboId: id,
        empresaId: empresa.id,
        puntoVentaId: doc.puntoVentaId,
        cedulaJuridica: empresa.cedulaJuridica,
        claveSituacion: empresa.claveSituacion,
        ambiente: empresa.ambiente,
        fechaEmision: new Date(),
        userId,
      });
    }
    await this.reciboRepo.updateEstado(id, "PENDIENTE_ENVIO", userId);
    await this.jobRepo.enqueue({
      jobType: "REINTENTO_ENVIO",
      empresaId: empresa.id,
      payload: { reciboPagoId: id, companyCode, documentKind: "recibo_pago" },
    });
    return { id, estado: "PENDIENTE_ENVIO" as const };
  }

  async procesarEnvioFacturaCompra(id: string, companyCode: string, userId?: string) {
    return this.procesarEnvioDocumentoComprobante({
      companyCode,
      userId,
      documentKind: "factura_compra",
      documentId: id,
      reservar: async (empresa) => {
        const doc = await this.compraRepo.findById(id, empresa.id);
        if (!doc.comprobanteId) {
          await this.comprobanteService.reservarFacturaCompra({
            facturaCompraId: id,
            empresaId: empresa.id,
            puntoVentaId: doc.puntoVentaId,
            cedulaJuridica: empresa.cedulaJuridica,
            fechaEmision: doc.fecha,
            userId,
          });
        }
      },
      validateDocument: async (empresa) => {
        const doc = await this.compraRepo.findById(id, empresa.id);
        validateFeV44FacturaCompra({ empresa, factura: doc, detalles: doc.detalles });
      },
      buildXml: (cid) => this.xmlService.buildAndPersistFacturaCompraXml(id, cid),
      updateEstado: (st) => this.compraRepo.updateEstado(id, st, userId),
      envioExtra: async () => ({}),
    });
  }

  async procesarEnvioReciboPago(id: string, companyCode: string, userId?: string) {
    return this.procesarEnvioDocumentoComprobante({
      companyCode,
      userId,
      documentKind: "recibo_pago",
      documentId: id,
      reservar: async (empresa) => {
        const doc = await this.reciboRepo.findById(id, empresa.id);
        if (!doc.comprobanteId) {
          await this.comprobanteService.reservarReciboPago({
            reciboId: id,
            empresaId: empresa.id,
            puntoVentaId: doc.puntoVentaId,
        cedulaJuridica: empresa.cedulaJuridica,
        claveSituacion: empresa.claveSituacion,
        ambiente: empresa.ambiente,
        fechaEmision: new Date(),
            userId,
          });
        }
      },
      validateDocument: async (empresa) => {
        const doc = await this.reciboRepo.findById(id, empresa.id);
        validateFeV44ReciboPago({ empresa, recibo: doc, detalles: doc.detalles });
      },
      buildXml: (cid) => this.xmlService.buildAndPersistReciboPagoXml(id, cid),
      updateEstado: (st) => this.reciboRepo.updateEstado(id, st, userId),
      envioExtra: async (empresa) => {
        const doc = await this.reciboRepo.findById(id, empresa.id);
        const cliente = doc.facturaReferencia?.cliente;
        return cliente
          ? { receptorTipo: cliente.tipoIdentificacion, receptorIdentificacion: cliente.identificacion }
          : {};
      },
    });
  }

  private async procesarEnvioDocumentoComprobante(params: {
    companyCode: string;
    documentKind: FeDocumentKind;
    documentId: string;
    userId?: string;
    reservar: (empresa: Awaited<ReturnType<FeEmpresaRepository["findByCompanyCode"]>>) => Promise<void>;
    validateDocument?: (
      empresa: Awaited<ReturnType<FeEmpresaRepository["findByCompanyCode"]>>
    ) => Promise<void>;
    buildXml: (companyCode: string) => Promise<{ xml: string; relativePath: string }>;
    updateEstado: (estado: FeFacturaEstado) => Promise<unknown>;
    envioExtra: (
      empresa: Awaited<ReturnType<FeEmpresaRepository["findByCompanyCode"]>>
    ) => Promise<{ receptorTipo?: import("@prisma/client").FeIdentificacionTipo; receptorIdentificacion?: string }>;
  }) {
    const empresa = await this.empresaRepo.findByCompanyCode(params.companyCode);
    this.assertEmisorListo(empresa);
    await params.reservar(empresa);

    const comprobanteRow = await this.prisma.feComprobanteElectronico.findFirst({
      where:
        params.documentKind === "factura_compra"
          ? { facturaCompra: { id: params.documentId } }
          : { reciboPago: { id: params.documentId } },
    });
    if (!comprobanteRow) throw new FeDomainError("Sin comprobante", "FE_SIN_COMPROBANTE");

    let comprobante = comprobanteRow;
    const comprobanteId = comprobante.id;

    try {
      await params.updateEstado("PENDIENTE_ENVIO");
      if (params.validateDocument) {
        await params.validateDocument(empresa);
      }
      const builtXml = comprobante.xmlSinFirmaPath
        ? null
        : await params.buildXml(params.companyCode);
      const xmlSinFirma = comprobante.xmlSinFirmaPath
        ? await this.xmlService.readXmlFromStorage(comprobante.xmlSinFirmaPath)
        : builtXml!.xml;

      if (builtXml) {
        validateFeXmlXsdOptional(xmlSinFirma, comprobante.tipo);
      }

      const { certPath: certPath4, certPasswordEnc: certPasswordEnc4 } = resolveCertForAmbiente(empresa);
      const signed = await feFirmaDigitalService.firmarXmlFromP12({
        companyCode: params.companyCode,
        comprobanteId,
        claveNumerica: comprobante.claveNumerica,
        p12RelativePath: certPath4!,
        p12PasswordEnc: certPasswordEnc4!,
        xml: xmlSinFirma,
        comprobanteTipo: comprobante.tipo,
      });

      await this.prisma.feComprobanteElectronico.update({
        where: { id: comprobanteId },
        data: { xmlFirmadoPath: signed.relativePath },
      });

      try {
        if (params.documentKind === "factura_compra") {
          await this.entrega.asegurarPdfFacturaCompra(params.documentId, params.companyCode);
        } else {
          await this.entrega.asegurarPdfReciboPago(params.documentId, params.companyCode);
        }
      } catch (pdfErr) {
        feLogger.warn("PDF comprobante no generado", {
          documentKind: params.documentKind,
          documentId: params.documentId,
          error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        });
      }

      const token = await feTokenHaciendaService.obtenerToken(empresa);
      const extra = await params.envioExtra(empresa);
      const envioStarted = Date.now();
      const envio = await feEnvioHaciendaService.enviarComprobante({
        ambiente: empresa.ambiente,
        token,
        clave: comprobante.claveNumerica,
        fechaEmision: comprobante.fechaEmision,
        emisorTipo: empresa.tipoIdentificacion ?? "JURIDICA",
        emisorIdentificacion: empresa.cedulaJuridica,
        ...extra,
        xmlFirmado: signed.xmlFirmado,
      });

      return this.finalizarEnvioHacienda({
        envio,
        envioStarted,
        comprobanteId,
        documentKind: params.documentKind,
        documentId: params.documentId,
        companyCode: params.companyCode,
        empresaId: empresa.id,
        userId: params.userId,
        updateEstado: params.updateEstado,
        returnKey: "id",
        returnId: params.documentId,
      });
    } catch (e) {
      await params.updateEstado("ERROR");
      throw e;
    }
  }

  async consultarEstadoDocumento(documentKind: FeDocumentKind, documentId: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);

    if (documentKind === "factura_compra") {
      const doc = await this.compraRepo.findById(documentId, empresa.id);
      if (!doc.comprobante) throw new FeDomainError("Sin comprobante", "FE_SIN_COMPROBANTE");
      return this.consultarEstadoComprobante({
        documentKind,
        documentId,
        comprobanteId: doc.comprobante.id,
        clave: doc.comprobante.claveNumerica,
        companyCode,
        empresa,
      });
    }

    if (documentKind === "recibo_pago") {
      const doc = await this.reciboRepo.findById(documentId, empresa.id);
      if (!doc.comprobante) throw new FeDomainError("Sin comprobante", "FE_SIN_COMPROBANTE");
      return this.consultarEstadoComprobante({
        documentKind,
        documentId,
        comprobanteId: doc.comprobante.id,
        clave: doc.comprobante.claveNumerica,
        companyCode,
        empresa,
      });
    }

    if (documentKind === "factura") {
      const factura = await this.facturaRepo.findById(documentId, empresa.id);
      if (!factura.comprobante) throw new FeDomainError("Factura sin comprobante", "FE_SIN_COMPROBANTE");
      return this.consultarEstadoComprobante({
        documentKind,
        documentId,
        comprobanteId: factura.comprobante.id,
        clave: factura.comprobante.claveNumerica,
        companyCode,
        empresa,
      });
    }

    if (documentKind === "mensaje_receptor") {
      const mensaje = await this.mensajeRepo.findById(documentId, empresa.id);
      if (!mensaje.comprobante) throw new FeDomainError("Mensaje sin comprobante", "FE_SIN_COMPROBANTE");
      return this.consultarEstadoComprobante({
        documentKind,
        documentId,
        comprobanteId: mensaje.comprobante.id,
        clave: mensaje.comprobante.claveNumerica,
        companyCode,
        empresa,
      });
    }

    const nota =
      documentKind === "nota_credito"
        ? await this.notaRepo.findCreditoById(documentId, empresa.id)
        : await this.notaRepo.findDebitoById(documentId, empresa.id);
    if (!nota.comprobante) throw new FeDomainError("Nota sin comprobante", "FE_SIN_COMPROBANTE");

    return this.consultarEstadoComprobante({
      documentKind,
      documentId,
      comprobanteId: nota.comprobante.id,
      clave: nota.comprobante.claveNumerica,
      companyCode,
      empresa,
    });
  }

  async consultarEstadoComprobante(params: {
    documentKind: FeDocumentKind;
    documentId: string;
    comprobanteId: string;
    clave: string;
    companyCode: string;
    empresa: Awaited<ReturnType<FeEmpresaRepository["findByCompanyCode"]>>;
  }) {
    const token = await feTokenHaciendaService.obtenerToken(params.empresa);
    const started = Date.now();
    const consulta = await feConsultaEstadoService.consultar({
      ambiente: params.empresa.ambiente,
      token,
      clave: params.clave,
    });

    await this.trazabilidad.log({
      comprobanteId: params.comprobanteId,
      operacion: "CONSULTAR_ESTADO",
      resultado: "EXITO",
      httpStatus: consulta.httpStatus,
      duracionMs: Date.now() - started,
      responseMeta: { indEstado: consulta.indEstado, raw: consulta.raw.slice(0, 2000) },
    });

    if (consulta.respuestaXml) {
      const comprobante = await this.prisma.feComprobanteElectronico.findUnique({
        where: { id: params.comprobanteId },
        select: { xmlRespuestaPath: true, claveNumerica: true },
      });
      if (comprobante && !comprobante.xmlRespuestaPath) {
        const persisted = await this.xmlService.persistRespuestaHaciendaXml({
          companyCode: params.companyCode,
          comprobanteId: params.comprobanteId,
          claveNumerica: comprobante.claveNumerica,
          xml: consulta.respuestaXml,
        });
        await this.trazabilidad.log({
          comprobanteId: params.comprobanteId,
          operacion: "CONSULTAR_ESTADO",
          resultado: "EXITO",
          responseMeta: { xmlRespuestaPath: persisted.relativePath },
        });
      }
    }

    await this.trazabilidad.registrarEstadoHacienda({
      comprobanteId: params.comprobanteId,
      estado: consulta.mapped.hacienda,
      mensaje: consulta.mensaje ?? consulta.indEstado,
      detalle: summarizeHaciendaConsultaRaw(consulta.raw),
    });

    await this.updateDocumentoEstado(params.documentKind, params.documentId, consulta.mapped.factura as FeFacturaEstado);

    if (consulta.mapped.terminal) {
      const comprobanteActual = await this.prisma.feComprobanteElectronico.findUnique({
        where: { id: params.comprobanteId },
        select: { xmlRespuestaPath: true },
      });
      if (!comprobanteActual?.xmlRespuestaPath) {
        feLogger.warn("Estado terminal Hacienda sin XML de respuesta persistido", {
          comprobanteId: params.comprobanteId,
          clave: params.clave,
          estado: consulta.mapped.factura,
        });
        await this.jobRepo.enqueue({
          jobType: "CONSULTA_ESTADO",
          empresaId: params.empresa.id,
          comprobanteId: params.comprobanteId,
          runAt: new Date(Date.now() + 120_000),
          payload: {
            documentKind: params.documentKind,
            documentId: params.documentId,
            companyCode: params.companyCode,
            comprobanteId: params.comprobanteId,
          },
        });
      } else {
        await this.entrega.entregaAutomaticaSiCorresponde(
          params.documentKind,
          params.documentId,
          params.companyCode,
          consulta.mapped.factura
        );
      }
      await this.contabilidad.contabilizarSiCorresponde(
        params.documentKind,
        params.documentId,
        consulta.mapped.factura
      );

      if (
        params.documentKind === "factura" &&
        (consulta.mapped.factura === "ACEPTADA" || consulta.mapped.factura === "ACEPTADA_PARCIALMENTE")
      ) {
        await this.jobRepo.enqueue({
          jobType: "SYNC_FRAPPE",
          empresaId: params.empresa.id,
          comprobanteId: params.comprobanteId,
          maxAttempts: 8,
          payload: {
            documentKind: params.documentKind,
            documentId: params.documentId,
            facturaId: params.documentId,
            companyCode: params.companyCode,
            comprobanteId: params.comprobanteId,
          },
        });
      }
    }

    return {
      documentKind: params.documentKind,
      documentId: params.documentId,
      estado: consulta.mapped.factura,
      hacienda: consulta.mapped.hacienda,
      terminal: consulta.mapped.terminal,
    };
  }

  private async finalizarEnvioHacienda(params: {
    envio: FeEnvioHaciendaResult;
    envioStarted: number;
    comprobanteId: string;
    documentKind: FeDocumentKind;
    documentId: string;
    companyCode: string;
    empresaId: string;
    userId?: string;
    updateEstado: (estado: FeFacturaEstado) => Promise<unknown>;
    returnKey: string;
    returnId: string;
    receivedMessage?: string;
  }): Promise<Record<string, string>> {
    if (params.envio.duplicateReceipt) {
      await this.trazabilidad.log({
        comprobanteId: params.comprobanteId,
        operacion: "ENVIAR_COMPROBANTE",
        resultado: "EXITO",
        httpStatus: params.envio.httpStatus,
        duracionMs: Date.now() - params.envioStarted,
        responseMeta: {
          duplicateReceipt: true,
          cause: params.envio.headers["x-error-cause"],
          headers: params.envio.headers,
        },
      });
      await params.updateEstado("ENVIADA");
      const consulta = await this.consultarEstadoDocumento(
        params.documentKind,
        params.documentId,
        params.companyCode
      );
      return { [params.returnKey]: params.returnId, estado: consulta.estado };
    }

    await this.trazabilidad.log({
      comprobanteId: params.comprobanteId,
      operacion: "ENVIAR_COMPROBANTE",
      resultado: "EXITO",
      httpStatus: params.envio.httpStatus,
      duracionMs: Date.now() - params.envioStarted,
      responseMeta: { body: params.envio.body.slice(0, 2000), headers: params.envio.headers },
    });

    await this.trazabilidad.registrarEstadoHacienda({
      comprobanteId: params.comprobanteId,
      estado: "RECIBIDO",
      mensaje: params.receivedMessage ?? "Comprobante recibido por Hacienda",
      detalle: params.envio.body.slice(0, 4000),
      codigoRespuesta: String(params.envio.httpStatus),
    });

    await params.updateEstado("ENVIADA");
    await this.consultarEstadoDocumento(params.documentKind, params.documentId, params.companyCode);

    await this.jobRepo.enqueue({
      jobType: "CONSULTA_ESTADO",
      empresaId: params.empresaId,
      comprobanteId: params.comprobanteId,
      runAt: new Date(Date.now() + 60_000),
      payload: {
        documentKind: params.documentKind,
        documentId: params.documentId,
        companyCode: params.companyCode,
        comprobanteId: params.comprobanteId,
      },
    });

    return { [params.returnKey]: params.returnId, estado: "ENVIADA" };
  }

  private async updateDocumentoEstado(
    kind: FeDocumentKind,
    id: string,
    estado: FeFacturaEstado,
    userId?: string
  ) {
    if (kind === "factura") return this.facturaRepo.updateEstado(id, estado, userId);
    if (kind === "factura_compra") return this.compraRepo.updateEstado(id, estado, userId);
    if (kind === "recibo_pago") return this.reciboRepo.updateEstado(id, estado, userId);
    if (kind === "nota_credito") return this.notaRepo.updateCreditoEstado(id, estado, userId);
    if (kind === "nota_debito") return this.notaRepo.updateDebitoEstado(id, estado, userId);
    return this.mensajeRepo.updateEstado(id, estado, userId);
  }

  private assertEmisorListo(empresa: EmpresaCertFields & {
    atvPasswordEnc: string | null;
    atvPasswordEncStg?: string | null;
    actividadEconomica: string | null;
  }) {
    const { certPath, certPasswordEnc } = resolveCertForAmbiente(empresa);
    if (!certPath || !certPasswordEnc) {
      const label = empresa.ambiente === "STAGING" ? "pruebas (Staging)" : "producción";
      throw new FeDomainError(
        `Configure el certificado digital (${label}) antes de enviar`,
        "FE_CERTIFICADO_REQUERIDO"
      );
    }
    const atvPasswordEnc = resolveAtvPasswordEncForToken(empresa);
    if (!atvPasswordEnc) {
      const label = empresa.ambiente === "STAGING" ? "pruebas (Staging)" : "producción";
      throw new FeDomainError(
        `Configure la contraseña ATV de Hacienda (${label})`,
        "FE_ATV_PASSWORD_REQUERIDA"
      );
    }
    if (!empresa.actividadEconomica?.trim()) {
      throw new FeDomainError(
        "Configure el código de actividad económica",
        "FE_ACTIVIDAD_REQUERIDA"
      );
    }
  }
}
