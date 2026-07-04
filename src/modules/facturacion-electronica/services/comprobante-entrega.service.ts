import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeFacturaCompraRepository } from "../repositories/fe-factura-compra.repository";
import { FeFacturaRepository } from "../repositories/fe-factura.repository";
import { FeReciboPagoRepository } from "../repositories/fe-recibo-pago.repository";
import { FeNotaRepository } from "../repositories/fe-nota.repository";
import { FeTrazabilidadService } from "./fe-trazabilidad.service";
import { feCorreoService } from "./mail/correo.service";
import { FePdfService } from "./pdf/pdf.service";
import { FE_TIPO_DOCUMENTO_LABEL } from "../constants/tipos-comprobante";
import type { FeDocumentKind } from "../validators/nota.schema";
import { notDeleted } from "../utils/soft-delete";
import { buildNotaReferenciaSnapshot } from "../utils/fe-nota-referencia";
import {
  buildFeComprobanteCcList,
  feRequiereXmlRespuestaParaCorreo,
} from "../utils/fe-comprobante-correo-cc";

const ESTADOS_CORREO_AUTO = new Set(["ACEPTADA", "ACEPTADA_PARCIALMENTE"]);

export class FeComprobanteEntregaService {
  private readonly facturaRepo: FeFacturaRepository;
  private readonly compraRepo: FeFacturaCompraRepository;
  private readonly reciboRepo: FeReciboPagoRepository;
  private readonly notaRepo: FeNotaRepository;
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly pdf: FePdfService;
  private readonly trazabilidad: FeTrazabilidadService;

  constructor(private readonly prisma: PrismaClient) {
    this.facturaRepo = new FeFacturaRepository(prisma);
    this.compraRepo = new FeFacturaCompraRepository(prisma);
    this.reciboRepo = new FeReciboPagoRepository(prisma);
    this.notaRepo = new FeNotaRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.pdf = new FePdfService(prisma);
    this.trazabilidad = new FeTrazabilidadService(prisma);
  }

  async asegurarPdfFactura(facturaId: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const factura = await this.facturaRepo.findById(facturaId, empresa.id);
    if (!factura.comprobante) {
      throw new FeDomainError("La factura no tiene comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    const started = Date.now();
    const pdf = await this.pdf.generarFacturaPdf(factura.comprobante.id, companyCode);
    await this.trazabilidad.log({
      comprobanteId: factura.comprobante.id,
      operacion: "GENERAR_PDF",
      resultado: "EXITO",
      duracionMs: Date.now() - started,
      responseMeta: { path: pdf.storagePath },
    });
    return pdf;
  }

  async asegurarPdfFacturaCompra(id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.compraRepo.findById(id, empresa.id);
    if (!doc.comprobante) {
      throw new FeDomainError("Sin comprobante electrónico", "FE_SIN_COMPROBANTE");
    }
    const started = Date.now();
    const pdf = await this.pdf.generarFacturaCompraPdf(doc.comprobante.id, companyCode);
    await this.trazabilidad.log({
      comprobanteId: doc.comprobante.id,
      operacion: "GENERAR_PDF",
      resultado: "EXITO",
      duracionMs: Date.now() - started,
      responseMeta: { path: pdf.storagePath },
    });
    return pdf;
  }

  async asegurarPdfReciboPago(id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.reciboRepo.findById(id, empresa.id);
    if (!doc.comprobante) {
      throw new FeDomainError("Sin comprobante electrónico", "FE_SIN_COMPROBANTE");
    }
    const started = Date.now();
    const pdf = await this.pdf.generarReciboPagoPdf(doc.comprobante.id, companyCode);
    await this.trazabilidad.log({
      comprobanteId: doc.comprobante.id,
      operacion: "GENERAR_PDF",
      resultado: "EXITO",
      duracionMs: Date.now() - started,
      responseMeta: { path: pdf.storagePath },
    });
    return pdf;
  }

  async asegurarPdfNota(kind: "nota_credito" | "nota_debito", notaId: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const nota =
      kind === "nota_credito"
        ? await this.notaRepo.findCreditoById(notaId, empresa.id)
        : await this.notaRepo.findDebitoById(notaId, empresa.id);
    if (!nota.comprobante) {
      throw new FeDomainError("La nota no tiene comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    const started = Date.now();
    const pdf =
      kind === "nota_credito"
        ? await this.pdf.generarNotaCreditoPdf(nota.comprobante.id, companyCode)
        : await this.pdf.generarNotaDebitoPdf(nota.comprobante.id, companyCode);
    await this.trazabilidad.log({
      comprobanteId: nota.comprobante.id,
      operacion: "GENERAR_PDF",
      resultado: "EXITO",
      duracionMs: Date.now() - started,
      responseMeta: { path: pdf.storagePath },
    });
    return pdf;
  }

  async enviarCorreoFactura(facturaId: string, companyCode: string, opts?: { forzar?: boolean }) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const factura = await this.facturaRepo.findById(facturaId, empresa.id);
    if (!factura.comprobante) {
      throw new FeDomainError("La factura no tiene comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    if (!factura.cliente?.email) {
      return { skipped: true, reason: "La factura no tiene cliente con correo electrónico" };
    }

    const tipo = factura.tipoDocumento ?? "FACTURA_ELECTRONICA";
    const tipoLabel = FE_TIPO_DOCUMENTO_LABEL[tipo] ?? "Factura electrónica";

    return this.enviarCorreoComprobante({
      comprobanteId: factura.comprobante.id,
      consecutivo: factura.comprobante.consecutivo,
      claveNumerica: factura.comprobante.claveNumerica,
      xmlPath: factura.comprobante.xmlFirmadoPath,
      xmlRespuestaPath: factura.comprobante.xmlRespuestaPath,
      destinatario: factura.cliente.email,
      destinatariosCopia: factura.cliente.emailCopia ? [factura.cliente.emailCopia] : undefined,
      nombreCliente: factura.cliente.nombre,
      empresa,
      companyCode,
      tipoLabel,
      forzar: opts?.forzar,
      generarPdf: () => this.asegurarPdfFactura(facturaId, companyCode),
    });
  }

  async enviarCorreoFacturaCompra(id: string, companyCode: string, opts?: { forzar?: boolean }) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.compraRepo.findById(id, empresa.id);
    if (!doc.comprobante) {
      throw new FeDomainError("Sin comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    const destinatario = empresa.correoRemitente ?? empresa.email;
    if (!destinatario?.trim()) {
      return { skipped: true, reason: "Emisor sin correo configurado" };
    }

    return this.enviarCorreoComprobante({
      comprobanteId: doc.comprobante.id,
      consecutivo: doc.comprobante.consecutivo,
      claveNumerica: doc.comprobante.claveNumerica,
      xmlPath: doc.comprobante.xmlFirmadoPath,
      xmlRespuestaPath: doc.comprobante.xmlRespuestaPath,
      destinatario,
      nombreCliente: empresa.nombreComercial,
      empresa,
      companyCode,
      tipoLabel: "Factura electrónica de compra",
      forzar: opts?.forzar,
      generarPdf: () => this.asegurarPdfFacturaCompra(id, companyCode),
    });
  }

  async enviarCorreoReciboPago(id: string, companyCode: string, opts?: { forzar?: boolean }) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.reciboRepo.findById(id, empresa.id);
    if (!doc.comprobante) {
      throw new FeDomainError("Sin comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    const cliente = doc.facturaReferencia?.cliente;
    if (!cliente?.email) {
      return { skipped: true, reason: "Sin cliente con correo en la factura referencia" };
    }

    return this.enviarCorreoComprobante({
      comprobanteId: doc.comprobante.id,
      consecutivo: doc.comprobante.consecutivo,
      claveNumerica: doc.comprobante.claveNumerica,
      xmlPath: doc.comprobante.xmlFirmadoPath,
      xmlRespuestaPath: doc.comprobante.xmlRespuestaPath,
      destinatario: cliente.email,
      destinatariosCopia: cliente.emailCopia ? [cliente.emailCopia] : undefined,
      nombreCliente: cliente.nombre,
      empresa,
      companyCode,
      tipoLabel: "Recibo electrónico de pago",
      forzar: opts?.forzar,
      generarPdf: () => this.asegurarPdfReciboPago(id, companyCode),
    });
  }

  async enviarCorreoNota(
    kind: "nota_credito" | "nota_debito",
    notaId: string,
    companyCode: string,
    opts?: { forzar?: boolean }
  ) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const nota =
      kind === "nota_credito"
        ? await this.notaRepo.findCreditoById(notaId, empresa.id)
        : await this.notaRepo.findDebitoById(notaId, empresa.id);
    if (!nota.comprobante) {
      throw new FeDomainError("La nota no tiene comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    const referencia = buildNotaReferenciaSnapshot(nota);
    const receptor = referencia.receptor;
    const clienteCopia =
      nota.facturaReferencia?.cliente?.emailCopia ??
      nota.reciboPagoReferencia?.facturaReferencia?.cliente?.emailCopia ??
      null;
    const tipoLabel = kind === "nota_credito" ? "Nota de crédito" : "Nota de débito";

    if (!receptor?.email) {
      return { skipped: true, reason: "El documento referencia no tiene receptor con correo" };
    }

    return this.enviarCorreoComprobante({
      comprobanteId: nota.comprobante.id,
      consecutivo: nota.comprobante.consecutivo,
      claveNumerica: nota.comprobante.claveNumerica,
      xmlPath: nota.comprobante.xmlFirmadoPath,
      xmlRespuestaPath: nota.comprobante.xmlRespuestaPath,
      destinatario: receptor.email,
      destinatariosCopia: clienteCopia ? [clienteCopia] : undefined,
      nombreCliente: receptor.nombre,
      empresa,
      companyCode,
      tipoLabel,
      forzar: opts?.forzar,
      generarPdf: () => this.asegurarPdfNota(kind, notaId, companyCode),
    });
  }

  private async enviarCorreoComprobante(params: {
    comprobanteId: string;
    consecutivo: string;
    claveNumerica: string;
    xmlPath: string | null | undefined;
    xmlRespuestaPath?: string | null;
    destinatario: string | null | undefined;
    destinatariosCopia?: string[];
    nombreCliente: string;
    empresa: Awaited<ReturnType<FeEmpresaRepository["findByCompanyCode"]>>;
    companyCode: string;
    tipoLabel: string;
    forzar?: boolean;
    generarPdf: () => Promise<{ storagePath: string; fileName: string }>;
  }) {
    if (!params.forzar) {
      const previo = await this.prisma.feHistorialEnvio.findFirst({
        where: {
          comprobanteId: params.comprobanteId,
          operacion: "REENVIAR_CORREO",
          resultado: "EXITO",
          ...notDeleted,
        },
      });
      if (previo) return { skipped: true as const, reason: "Correo ya enviado" };
    }

    if (!params.destinatario?.trim()) {
      throw new FeDomainError("El cliente no tiene correo electrónico", "FE_CLIENTE_SIN_EMAIL");
    }
    if (!params.xmlPath) {
      throw new FeDomainError("No hay XML firmado para adjuntar", "FE_SIN_XML_FIRMADO");
    }

    const integracionFae = feRequiereXmlRespuestaParaCorreo(params.empresa);
    if (integracionFae && !params.xmlRespuestaPath) {
      return {
        skipped: true as const,
        reason:
          "Falta el XML de respuesta de Hacienda. Use «Consultar estado» y vuelva a enviar el correo.",
      };
    }

    const pdf = await params.generarPdf();
    const asunto = `${params.tipoLabel} ${params.consecutivo} — ${params.empresa.nombreComercial}`;
    const cuerpo =
      `Estimado/a ${params.nombreCliente}:\n\n` +
      `Adjuntamos ${params.tipoLabel.toLowerCase()} ${params.consecutivo} ` +
      `(clave ${params.claveNumerica}).\n\n` +
      `Este mensaje fue enviado automáticamente desde Alfa One.`;

    const ccList = buildFeComprobanteCcList(
      params.destinatario,
      params.empresa,
      params.destinatariosCopia
    );

    const started = Date.now();
    try {
      const result = await feCorreoService.enviarComprobante({
        empresa: params.empresa,
        destinatario: params.destinatario,
        destinatariosCopia: ccList.length ? ccList : undefined,
        remitenteEmail: params.empresa.correoRemitente ?? params.empresa.email,
        remitenteNombre: params.empresa.correoNombre ?? params.empresa.nombreComercial,
        asunto,
        cuerpo,
        xmlPath: params.xmlPath,
        pdfPath: pdf.storagePath,
        xmlFileName: `${params.consecutivo}.xml`,
        xmlRespuestaPath: params.xmlRespuestaPath,
        xmlRespuestaFileName: `${params.claveNumerica}-respuesta.xml`,
        pdfFileName: pdf.fileName,
      });

      await this.trazabilidad.log({
        comprobanteId: params.comprobanteId,
        operacion: "REENVIAR_CORREO",
        resultado: "EXITO",
        duracionMs: Date.now() - started,
        responseMeta: { to: params.destinatario, messageId: result.messageId },
      });

      return { skipped: false as const, ...result };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.trazabilidad.log({
        comprobanteId: params.comprobanteId,
        operacion: "REENVIAR_CORREO",
        resultado: "ERROR",
        duracionMs: Date.now() - started,
        errorMessage: message,
      });
      throw e;
    }
  }

  async entregaAutomaticaSiCorresponde(
    kind: FeDocumentKind,
    documentId: string,
    companyCode: string,
    estado: string
  ) {
    if (!ESTADOS_CORREO_AUTO.has(estado)) return null;
    if (kind === "mensaje_receptor") return null;

    try {
      if (kind === "factura") return await this.enviarCorreoFactura(documentId, companyCode);
      if (kind === "factura_compra") return await this.enviarCorreoFacturaCompra(documentId, companyCode);
      if (kind === "recibo_pago") return await this.enviarCorreoReciboPago(documentId, companyCode);
      if (kind === "nota_credito") return await this.enviarCorreoNota("nota_credito", documentId, companyCode);
      if (kind === "nota_debito") return await this.enviarCorreoNota("nota_debito", documentId, companyCode);
      return null;
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
}
