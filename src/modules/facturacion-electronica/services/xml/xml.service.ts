import { readFile, writeFile } from "fs/promises";
import type { PrismaClient } from "@prisma/client";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { buildFacturaElectronicaXml } from "./builders/factura-electronica.builder";
import { buildDocumentoVentaXml } from "./builders/documento-venta.builder";
import { buildFacturaCompraXml } from "./builders/factura-compra.builder";
import { buildReciboPagoXml } from "./builders/recibo-pago.builder";
import { buildNotaCreditoXml, buildNotaDebitoXml } from "./builders/nota-electronica.builder";
import { buildMensajeReceptorXml } from "./builders/mensaje-receptor.builder";
import { notDeleted } from "../../utils/soft-delete";
import { FeDomainError, FeNotFoundError } from "../../errors/fe-errors";
import { ensureFeDir, feRelativePath, feXmlDir, FE_STORAGE_ROOT } from "../../utils/fe-storage";
import { buildNotaReferenciaSnapshot, notaReferenciaInclude } from "../../utils/fe-nota-referencia";

export class FeXmlService {
  constructor(private readonly prisma: PrismaClient) {}

  async buildFacturaElectronica(facturaId: string, companyCode: string): Promise<string> {
    const ctx = await this.loadFacturaContext(facturaId, companyCode);
    return buildFacturaElectronicaXml({ ...ctx, cliente: ctx.cliente! });
  }

  async buildAndPersistFacturaXml(facturaId: string, companyCode: string): Promise<{ xml: string; relativePath: string }> {
    const ctx = await this.loadFacturaContext(facturaId, companyCode);
    const tipo = ctx.factura.tipoDocumento ?? "FACTURA_ELECTRONICA";
    const xml =
      tipo === "FACTURA_ELECTRONICA"
        ? buildFacturaElectronicaXml({ ...ctx, cliente: ctx.cliente! })
        : buildDocumentoVentaXml({
            ...ctx,
            tipoDocumento: tipo as "TIQUETE_ELECTRONICO" | "FACTURA_ELECTRONICA_EXPORTACION" | "FACTURA_ELECTRONICA",
            cliente: ctx.cliente,
          });
    const dir = feXmlDir(companyCode, ctx.comprobante.id);
    await ensureFeDir(dir);
    const fileName = `${ctx.comprobante.claveNumerica}-sin-firma.xml`;
    const abs = `${dir}/${fileName}`;
    await writeFile(abs, xml, "utf8");
    const relativePath = feRelativePath(companyCode, "xml", ctx.comprobante.id, fileName);

    await this.prisma.feComprobanteElectronico.update({
      where: { id: ctx.comprobante.id },
      data: { xmlSinFirmaPath: relativePath },
    });

    return { xml, relativePath };
  }

  async buildAndPersistNotaCreditoXml(notaId: string, companyCode: string) {
    const ctx = await this.loadNotaCreditoContext(notaId, companyCode);
    const referencia = buildNotaReferenciaSnapshot(ctx.nota);
    const xml = buildNotaCreditoXml({
      empresa: ctx.empresa,
      referencia,
      comprobante: ctx.comprobante,
      nota: ctx.nota,
      detalles: ctx.detalles,
      codigoReferencia: ctx.nota.codigoReferencia,
    });
    return this.persistXml(companyCode, ctx.comprobante.id, ctx.comprobante.claveNumerica, xml);
  }

  async buildAndPersistNotaDebitoXml(notaId: string, companyCode: string) {
    const ctx = await this.loadNotaDebitoContext(notaId, companyCode);
    const referencia = buildNotaReferenciaSnapshot(ctx.nota);
    const xml = buildNotaDebitoXml({
      empresa: ctx.empresa,
      referencia,
      comprobante: ctx.comprobante,
      nota: ctx.nota,
      detalles: ctx.detalles,
      codigoReferencia: ctx.nota.codigoReferencia,
    });
    return this.persistXml(companyCode, ctx.comprobante.id, ctx.comprobante.claveNumerica, xml);
  }

  async buildAndPersistMensajeReceptorXml(mensajeId: string, companyCode: string) {
    const ctx = await this.loadMensajeReceptorContext(mensajeId, companyCode);
    const xml = buildMensajeReceptorXml({
      claveComprobanteRecibido: ctx.mensaje.claveComprobante,
      cedulaEmisor: ctx.mensaje.cedulaEmisor,
      fechaEmisionMensaje: ctx.comprobante.fechaEmision,
      tipoMensaje: ctx.mensaje.tipoMensaje,
      detalleMensaje: ctx.mensaje.detalleMensaje,
      montoTotalImpuesto: ctx.mensaje.montoTotalImpuesto ? Number(ctx.mensaje.montoTotalImpuesto) : null,
      montoTotal: ctx.mensaje.montoTotal ? Number(ctx.mensaje.montoTotal) : null,
    });
    return this.persistXml(companyCode, ctx.comprobante.id, ctx.comprobante.claveNumerica, xml);
  }

  async buildAndPersistFacturaCompraXml(facturaCompraId: string, companyCode: string) {
    const ctx = await this.loadFacturaCompraContext(facturaCompraId, companyCode);
    const xml = buildFacturaCompraXml(ctx);
    return this.persistXml(companyCode, ctx.comprobante.id, ctx.comprobante.claveNumerica, xml);
  }

  async buildAndPersistReciboPagoXml(reciboId: string, companyCode: string) {
    const ctx = await this.loadReciboPagoContext(reciboId, companyCode);
    const xml = buildReciboPagoXml(ctx);
    return this.persistXml(companyCode, ctx.comprobante.id, ctx.comprobante.claveNumerica, xml);
  }

  private async persistXml(companyCode: string, comprobanteId: string, claveNumerica: string, xml: string) {
    const dir = feXmlDir(companyCode, comprobanteId);
    await ensureFeDir(dir);
    const fileName = `${claveNumerica}-sin-firma.xml`;
    const abs = `${dir}/${fileName}`;
    await writeFile(abs, xml, "utf8");
    const relativePath = feRelativePath(companyCode, "xml", comprobanteId, fileName);
    await this.prisma.feComprobanteElectronico.update({
      where: { id: comprobanteId },
      data: { xmlSinFirmaPath: relativePath },
    });
    return { xml, relativePath };
  }

  async readXmlFromStorage(relativePath: string): Promise<string> {
    const abs = resolveUnderRoot(FE_STORAGE_ROOT, relativePath);
    if (!abs) throw new FeDomainError("Ruta XML inválida", "FE_XML_PATH_INVALID");
    return readFile(abs, "utf8");
  }

  async persistRespuestaHaciendaXml(params: {
    companyCode: string;
    comprobanteId: string;
    claveNumerica: string;
    xml: string;
  }): Promise<{ relativePath: string; fileName: string }> {
    const dir = feXmlDir(params.companyCode, params.comprobanteId);
    await ensureFeDir(dir);
    const fileName = `${params.claveNumerica}-respuesta.xml`;
    const abs = `${dir}/${fileName}`;
    await writeFile(abs, params.xml, "utf8");
    const relativePath = feRelativePath(params.companyCode, "xml", params.comprobanteId, fileName);

    await this.prisma.feComprobanteElectronico.update({
      where: { id: params.comprobanteId },
      data: { xmlRespuestaPath: relativePath },
    });

    const sizeBytes = Buffer.byteLength(params.xml, "utf8");
    await this.prisma.feAdjuntoXML.create({
      data: {
        comprobanteId: params.comprobanteId,
        origen: "RESPUESTA_HACIENDA",
        storagePath: relativePath,
        fileName,
        sizeBytes,
      },
    });

    return { relativePath, fileName };
  }

  private async loadFacturaContext(facturaId: string, companyCode: string) {
    const factura = await this.prisma.feFactura.findFirst({
      where: { id: facturaId, ...notDeleted, empresa: { companyCode, ...notDeleted } },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        cliente: true,
        comprobante: true,
        empresa: true,
        puntoVenta: { include: { sucursal: true } },
      },
    });

    if (!factura?.comprobante) throw new FeNotFoundError("Factura o comprobante no encontrado");
    if (!factura.empresa.actividadEconomica?.trim()) {
      throw new FeDomainError(
        "Configure el código de actividad económica del emisor",
        "FE_ACTIVIDAD_REQUERIDA"
      );
    }

    return {
      empresa: factura.empresa,
      factura,
      detalles: factura.detalles,
      cliente: factura.cliente,
      comprobante: factura.comprobante,
      puntoVenta: factura.puntoVenta,
    };
  }

  private notaEmpresaFilter(companyCode: string) {
    return {
      OR: [
        { facturaReferencia: { empresa: { companyCode, ...notDeleted }, ...notDeleted } },
        { facturaCompraReferencia: { empresa: { companyCode, ...notDeleted }, ...notDeleted } },
        { reciboPagoReferencia: { empresa: { companyCode, ...notDeleted }, ...notDeleted } },
      ],
    };
  }

  private resolveNotaEmpresa(nota: {
    facturaReferencia?: { empresa: import("@prisma/client").FeEmpresa } | null;
    facturaCompraReferencia?: { empresa: import("@prisma/client").FeEmpresa } | null;
    reciboPagoReferencia?: { empresa: import("@prisma/client").FeEmpresa } | null;
  }) {
    const empresa =
      nota.facturaReferencia?.empresa ??
      nota.facturaCompraReferencia?.empresa ??
      nota.reciboPagoReferencia?.empresa;
    if (!empresa?.actividadEconomica?.trim()) {
      throw new FeDomainError("Configure el código de actividad económica del emisor", "FE_ACTIVIDAD_REQUERIDA");
    }
    return empresa;
  }

  private async loadNotaCreditoContext(notaId: string, companyCode: string) {
    const nota = await this.prisma.feNotaCredito.findFirst({
      where: { id: notaId, ...notDeleted, ...this.notaEmpresaFilter(companyCode) },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
        ...notaReferenciaInclude,
      },
    });
    if (!nota?.comprobante) throw new FeNotFoundError("Nota o comprobante no encontrado");
    return {
      nota,
      detalles: nota.detalles,
      comprobante: nota.comprobante,
      empresa: this.resolveNotaEmpresa(nota),
    };
  }

  private async loadNotaDebitoContext(notaId: string, companyCode: string) {
    const nota = await this.prisma.feNotaDebito.findFirst({
      where: { id: notaId, ...notDeleted, ...this.notaEmpresaFilter(companyCode) },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
        ...notaReferenciaInclude,
      },
    });
    if (!nota?.comprobante) throw new FeNotFoundError("Nota o comprobante no encontrado");
    return {
      nota,
      detalles: nota.detalles,
      comprobante: nota.comprobante,
      empresa: this.resolveNotaEmpresa(nota),
    };
  }

  private async loadMensajeReceptorContext(mensajeId: string, companyCode: string) {
    const mensaje = await this.prisma.feMensajeReceptor.findFirst({
      where: { id: mensajeId, ...notDeleted, empresa: { companyCode, ...notDeleted } },
      include: { comprobante: true, empresa: true },
    });
    if (!mensaje?.comprobante) throw new FeNotFoundError("Mensaje o comprobante no encontrado");
    return { mensaje, comprobante: mensaje.comprobante, empresa: mensaje.empresa };
  }

  private async loadFacturaCompraContext(facturaCompraId: string, companyCode: string) {
    const factura = await this.prisma.feFacturaCompra.findFirst({
      where: { id: facturaCompraId, ...notDeleted, empresa: { companyCode, ...notDeleted } },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
        empresa: true,
      },
    });
    if (!factura?.comprobante) throw new FeNotFoundError("Factura compra o comprobante no encontrado");
    return { empresa: factura.empresa, factura, detalles: factura.detalles, comprobante: factura.comprobante };
  }

  private async loadReciboPagoContext(reciboId: string, companyCode: string) {
    const recibo = await this.prisma.feReciboPago.findFirst({
      where: { id: reciboId, ...notDeleted, empresa: { companyCode, ...notDeleted } },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
        empresa: true,
        facturaReferencia: { include: { cliente: true } },
      },
    });
    if (!recibo?.comprobante) throw new FeNotFoundError("Recibo o comprobante no encontrado");
    return {
      empresa: recibo.empresa,
      recibo,
      detalles: recibo.detalles,
      comprobante: recibo.comprobante,
      cliente: recibo.facturaReferencia?.cliente ?? null,
    };
  }
}

export const feXmlServiceFactory = (prisma: PrismaClient) => new FeXmlService(prisma);
