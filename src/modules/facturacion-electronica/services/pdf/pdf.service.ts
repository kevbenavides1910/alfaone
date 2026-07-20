import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../../errors/fe-errors";
import { FeEmpresaRepository } from "../../repositories/fe-empresa.repository";
import { FeFacturaRepository } from "../../repositories/fe-factura.repository";
import { notDeleted } from "../../utils/soft-delete";
import {
  ensureFeDir,
  feAbsolutePath,
  fePdfDir,
  feRelativePath,
} from "../../utils/fe-storage";
import { FE_PDF_PREFIX, FE_TIPO_DOCUMENTO_LABEL } from "../../constants/tipos-comprobante";
import { buildNotaReferenciaSnapshot, notaEmpresaWhere, notaReferenciaInclude } from "../../utils/fe-nota-referencia";
import { loadFeEmpresaLogoFile } from "../../utils/fe-pdf-logo";
import { buildFacturaElectronicaPdf } from "./factura-electronica-pdf";

function dec(v: unknown): number {
  return Number(v);
}

function clientePdfBlock(cliente: {
  nombre: string;
  identificacion: string;
  tipoIdentificacion: string;
  email?: string | null;
} | null | undefined) {
  return {
    nombre: cliente?.nombre ?? "Consumidor final",
    identificacion: cliente?.identificacion ?? "",
    tipoIdentificacion: cliente?.tipoIdentificacion ?? "FISICA",
    email: cliente?.email ?? null,
  };
}

export class FePdfService {
  private readonly facturaRepo: FeFacturaRepository;
  private readonly empresaRepo: FeEmpresaRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.facturaRepo = new FeFacturaRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
  }

  async generarNotaCreditoPdf(comprobanteId: string, companyCode: string) {
    return this.generarNotaPdf(comprobanteId, companyCode, "credito");
  }

  async generarNotaDebitoPdf(comprobanteId: string, companyCode: string) {
    return this.generarNotaPdf(comprobanteId, companyCode, "debito");
  }

  private async generarNotaPdf(
    comprobanteId: string,
    companyCode: string,
    tipo: "credito" | "debito"
  ) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const nota =
      tipo === "credito"
        ? await this.prisma.feNotaCredito.findFirst({
            where: { comprobanteId, ...notDeleted, ...notaEmpresaWhere(empresa.id) },
            include: {
              detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
              comprobante: true,
              ...notaReferenciaInclude,
            },
          })
        : await this.prisma.feNotaDebito.findFirst({
            where: { comprobanteId, ...notDeleted, ...notaEmpresaWhere(empresa.id) },
            include: {
              detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
              comprobante: true,
              ...notaReferenciaInclude,
            },
          });

    if (!nota?.comprobante) {
      throw new FeDomainError("Comprobante no encontrado para PDF", "FE_SIN_COMPROBANTE");
    }

    const prefix = tipo === "credito" ? "NC" : "ND";
    const titulo = tipo === "credito" ? "NOTA DE CRÉDITO ELECTRÓNICA" : "NOTA DE DÉBITO ELECTRÓNICA";
    const ref = buildNotaReferenciaSnapshot(nota);
    const receptor = ref.receptor;
    const logoFile = await loadFeEmpresaLogoFile(empresa);

    return this.persistPdf({
      comprobanteId,
      companyCode,
      fileName: `${prefix}-${nota.comprobante.consecutivo}.pdf`,
      pdfInput: {
        ambiente: empresa.ambiente,
        logoFile,
        tituloDocumento: titulo,
        emisor: {
          razonSocial: empresa.razonSocial,
          nombreComercial: empresa.nombreComercial,
          cedulaJuridica: empresa.cedulaJuridica,
          telefono: empresa.telefono,
          email: empresa.email,
        },
        comprobante: {
          claveNumerica: nota.comprobante.claveNumerica,
          consecutivo: nota.comprobante.consecutivo,
          fechaEmision: nota.comprobante.fechaEmision,
        },
        cliente: clientePdfBlock(
          receptor
            ? {
                nombre: receptor.nombre,
                identificacion: receptor.identificacion,
                tipoIdentificacion: receptor.tipoIdentificacion,
                email: receptor.email,
              }
            : null
        ),
        factura: {
          moneda: ref.moneda,
          condicionVenta: ref.condicionVenta,
          medioPago: ref.medioPago,
          observaciones: nota.razon,
          subtotal: dec(nota.subtotal),
          totalDescuentos: dec(nota.totalDescuentos),
          totalImpuestos: dec(nota.totalImpuestos),
          total: dec(nota.total),
        },
        detalles: nota.detalles.map((d) => ({
          numeroLinea: d.numeroLinea,
          descripcion: d.descripcion,
          cantidad: dec(d.cantidad),
          unidadMedida: d.unidadMedida,
          precioUnitario: dec(d.precioUnitario),
          montoImpuesto: dec(d.montoImpuesto),
          totalLinea: dec(d.totalLinea),
        })),
      },
    });
  }

  private async persistPdf(params: {
    comprobanteId: string;
    companyCode: string;
    fileName: string;
    pdfInput: Parameters<typeof buildFacturaElectronicaPdf>[0];
  }) {
    const pdfBytes = await buildFacturaElectronicaPdf(params.pdfInput);
    const sha256 = createHash("sha256").update(pdfBytes).digest("hex");

    const existing = await this.prisma.feAdjuntoPDF.findFirst({
      where: { comprobanteId: params.comprobanteId, origen: "GENERADO", ...notDeleted },
      orderBy: { createdAt: "desc" },
    });

    // Siempre regenera el PDF (p. ej. mejoras de diseño) sobre la misma ruta.
    if (existing) {
      const absPath = feAbsolutePath(existing.storagePath);
      await ensureFeDir(path.dirname(absPath));
      await fs.writeFile(absPath, pdfBytes);
      await this.prisma.feAdjuntoPDF.update({
        where: { id: existing.id },
        data: { sha256, sizeBytes: pdfBytes.length, fileName: params.fileName },
      });
      return { storagePath: existing.storagePath, fileName: params.fileName, id: existing.id };
    }

    const absDir = fePdfDir(params.companyCode, params.comprobanteId);
    await ensureFeDir(absDir);
    const absPath = path.join(absDir, params.fileName);
    await fs.writeFile(absPath, pdfBytes);

    const relativePath = feRelativePath(params.companyCode, "pdf", params.comprobanteId, params.fileName);

    const adjunto = await this.prisma.feAdjuntoPDF.create({
      data: {
        comprobanteId: params.comprobanteId,
        origen: "GENERADO",
        storagePath: relativePath,
        fileName: params.fileName,
        mimeType: "application/pdf",
        sha256,
        sizeBytes: pdfBytes.length,
      },
    });

    return { storagePath: relativePath, fileName: params.fileName, id: adjunto.id };
  }

  async generarFacturaPdf(
    comprobanteId: string,
    companyCode: string
  ): Promise<{ storagePath: string; fileName: string; id: string }> {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const factura = await this.prisma.feFactura.findFirst({
      where: { comprobanteId, empresaId: empresa.id, ...notDeleted },
      include: {
        cliente: true,
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
      },
    });

    if (!factura?.comprobante) {
      throw new FeDomainError("Comprobante no encontrado para PDF", "FE_SIN_COMPROBANTE");
    }

    const tipo = factura.tipoDocumento ?? "FACTURA_ELECTRONICA";
    const prefix = FE_PDF_PREFIX[tipo] ?? "FE";
    const titulo = FE_TIPO_DOCUMENTO_LABEL[tipo]?.toUpperCase() ?? "FACTURA ELECTRÓNICA";
    const logoFile = await loadFeEmpresaLogoFile(empresa);

    return this.persistPdf({
      comprobanteId,
      companyCode,
      fileName: `${prefix}-${factura.comprobante.consecutivo}.pdf`,
      pdfInput: {
        ambiente: empresa.ambiente,
        logoFile,
        tituloDocumento: titulo,
        emisor: {
          razonSocial: empresa.razonSocial,
          nombreComercial: empresa.nombreComercial,
          cedulaJuridica: empresa.cedulaJuridica,
          telefono: empresa.telefono,
          email: empresa.email,
        },
        comprobante: {
          claveNumerica: factura.comprobante.claveNumerica,
          consecutivo: factura.comprobante.consecutivo,
          fechaEmision: factura.comprobante.fechaEmision,
        },
        cliente: clientePdfBlock(factura.cliente),
        factura: {
          moneda: factura.moneda,
          condicionVenta: factura.condicionVenta,
          medioPago: factura.medioPago,
          observaciones: factura.observaciones,
          subtotal: dec(factura.subtotal),
          totalDescuentos: dec(factura.totalDescuentos),
          totalImpuestos: dec(factura.totalImpuestos),
          total: dec(factura.total),
        },
        detalles: factura.detalles.map((d) => ({
          numeroLinea: d.numeroLinea,
          descripcion: d.descripcion,
          cantidad: dec(d.cantidad),
          unidadMedida: d.unidadMedida,
          precioUnitario: dec(d.precioUnitario),
          montoImpuesto: dec(d.montoImpuesto),
          totalLinea: dec(d.totalLinea),
        })),
      },
    });
  }

  async generarFacturaCompraPdf(comprobanteId: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.prisma.feFacturaCompra.findFirst({
      where: { comprobanteId, empresaId: empresa.id, ...notDeleted },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
      },
    });
    if (!doc?.comprobante) {
      throw new FeDomainError("Comprobante no encontrado para PDF", "FE_SIN_COMPROBANTE");
    }

    const logoFile = await loadFeEmpresaLogoFile(empresa);

    return this.persistPdf({
      comprobanteId,
      companyCode,
      fileName: `FEC-${doc.comprobante.consecutivo}.pdf`,
      pdfInput: {
        ambiente: empresa.ambiente,
        logoFile,
        tituloDocumento: "FACTURA ELECTRÓNICA DE COMPRA",
        emisor: {
          razonSocial: empresa.razonSocial,
          nombreComercial: empresa.nombreComercial,
          cedulaJuridica: empresa.cedulaJuridica,
          telefono: empresa.telefono,
          email: empresa.email,
        },
        comprobante: {
          claveNumerica: doc.comprobante.claveNumerica,
          consecutivo: doc.comprobante.consecutivo,
          fechaEmision: doc.comprobante.fechaEmision,
        },
        cliente: {
          nombre: doc.proveedorNombre,
          identificacion: doc.proveedorIdentificacion,
          tipoIdentificacion: doc.proveedorTipoIdentificacion,
          email: null,
        },
        factura: {
          moneda: doc.moneda,
          condicionVenta: doc.condicionVenta,
          medioPago: "TRANSFERENCIA_DEPOSITO",
          observaciones: doc.observaciones,
          subtotal: dec(doc.subtotal),
          totalDescuentos: dec(doc.totalDescuentos),
          totalImpuestos: dec(doc.totalImpuestos),
          total: dec(doc.total),
        },
        detalles: doc.detalles.map((d) => ({
          numeroLinea: d.numeroLinea,
          descripcion: d.descripcion,
          cantidad: dec(d.cantidad),
          unidadMedida: d.unidadMedida,
          precioUnitario: dec(d.precioUnitario),
          montoImpuesto: dec(d.montoImpuesto),
          totalLinea: dec(d.totalLinea),
        })),
      },
    });
  }

  async generarReciboPagoPdf(comprobanteId: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.prisma.feReciboPago.findFirst({
      where: { comprobanteId, empresaId: empresa.id, ...notDeleted },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
        facturaReferencia: { include: { cliente: true } },
      },
    });
    if (!doc?.comprobante) {
      throw new FeDomainError("Comprobante no encontrado para PDF", "FE_SIN_COMPROBANTE");
    }

    const logoFile = await loadFeEmpresaLogoFile(empresa);

    return this.persistPdf({
      comprobanteId,
      companyCode,
      fileName: `REP-${doc.comprobante.consecutivo}.pdf`,
      pdfInput: {
        ambiente: empresa.ambiente,
        logoFile,
        tituloDocumento: "RECIBO ELECTRÓNICO DE PAGO",
        emisor: {
          razonSocial: empresa.razonSocial,
          nombreComercial: empresa.nombreComercial,
          cedulaJuridica: empresa.cedulaJuridica,
          telefono: empresa.telefono,
          email: empresa.email,
        },
        comprobante: {
          claveNumerica: doc.comprobante.claveNumerica,
          consecutivo: doc.comprobante.consecutivo,
          fechaEmision: doc.comprobante.fechaEmision,
        },
        cliente: clientePdfBlock(doc.facturaReferencia?.cliente),
        factura: {
          moneda: "CRC",
          condicionVenta: doc.condicionVenta,
          medioPago: doc.medioPago,
          observaciones: doc.razon,
          subtotal: dec(doc.subtotal),
          totalDescuentos: 0,
          totalImpuestos: dec(doc.totalImpuestos),
          total: dec(doc.total),
        },
        detalles: doc.detalles.map((d, i) => ({
          numeroLinea: d.numeroLinea || i + 1,
          descripcion: d.descripcion,
          cantidad: 1,
          unidadMedida: "Unid",
          precioUnitario: dec(d.subTotal),
          montoImpuesto: dec(d.montoImpuesto),
          totalLinea: dec(d.totalLinea),
        })),
      },
    });
  }
}
