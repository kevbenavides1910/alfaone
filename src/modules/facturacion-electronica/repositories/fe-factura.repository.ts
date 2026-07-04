import type { FeFacturaEstado, Prisma, PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";
import { FeDomainError, FeNotFoundError } from "../errors/fe-errors";
import type { CreateFeFacturaInput } from "../validators/factura.schema";

const EDITABLE_ESTADOS: FeFacturaEstado[] = ["BORRADOR", "ERROR", "PENDIENTE_ENVIO"];

const facturaInclude = {
  detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" as const } },
  cliente: true,
  comprobante: true,
  facturaMensual: { select: { id: true, periodMonth: true, periodYear: true, status: true } },
  notasCredito: {
    where: notDeleted,
    orderBy: { createdAt: "desc" },
    include: { comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } } },
  },
  notasDebito: {
    where: notDeleted,
    orderBy: { createdAt: "desc" },
    include: { comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } } },
  },
} satisfies Prisma.FeFacturaInclude;

export class FeFacturaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    empresaId: string,
    input: CreateFeFacturaInput,
    userId?: string
  ) {
    return this.prisma.feFactura.create({
      data: {
        empresaId,
        puntoVentaId: input.puntoVentaId,
        clienteId: input.clienteId,
        tipoDocumento: input.tipoDocumento ?? "FACTURA_ELECTRONICA",
        fecha: input.fecha,
        moneda: input.moneda,
        tipoCambio: input.tipoCambio,
        condicionVenta: input.condicionVenta,
        condicionVentaOtro: input.condicionVentaOtro,
        medioPago: input.medioPago,
        medioPagoOtro: input.medioPagoOtro,
        mediosPago: input.mediosPago?.length ? input.mediosPago : undefined,
        plazoCredito: input.plazoCredito,
        observaciones: input.observaciones,
        subtotal: input.subtotal,
        totalDescuentos: input.totalDescuentos,
        totalImpuestos: input.totalImpuestos,
        totalOtrosCargos: input.totalOtrosCargos ?? 0,
        otrosCargos: input.otrosCargos?.length ? input.otrosCargos : undefined,
        totalIvaDevuelto: input.totalIvaDevuelto ?? 0,
        total: input.total,
        facturaMensualId: input.facturaMensualId,
        createdById: userId,
        updatedById: userId,
        detalles: {
          create: input.detalles.map((line, index) => ({
            numeroLinea: index + 1,
            codigo: line.codigo,
            codigoCabys: line.codigoCabys,
            descripcion: line.descripcion,
            cantidad: line.cantidad,
            unidadMedida: line.unidadMedida,
            precioUnitario: line.precioUnitario,
            montoDescuento: line.montoDescuento,
            codigoDescuento: line.codigoDescuento ?? (Number(line.montoDescuento) > 0 ? "99" : undefined),
            naturalezaDescuento: line.naturalezaDescuento,
            codigoImpuesto: line.codigoImpuesto,
            tarifaImpuesto: line.tarifaImpuesto,
            montoImpuesto: line.montoImpuesto,
            totalLinea: line.totalLinea,
            exonTipoDocumento: line.exoneracion?.exonTipoDocumento,
            exonNumeroDocumento: line.exoneracion?.exonNumeroDocumento,
            exonNombreInstitucion: line.exoneracion?.exonNombreInstitucion,
            exonFechaEmision: line.exoneracion?.exonFechaEmision,
            exonPorcentaje: line.exoneracion?.exonPorcentaje,
            exonMonto: line.exoneracion?.exonMonto,
            ivaCobradoFabrica: line.ivaCobradoFabrica,
            impuestoAsumidoFabrica: line.impuestoAsumidoFabrica ?? 0,
            partidaArancelaria: line.partidaArancelaria,
            montoImpuestoExportacion: line.montoImpuestoExportacion,
          })),
        },
      },
      include: facturaInclude,
    });
  }

  async findById(id: string, empresaId: string) {
    const row = await this.prisma.feFactura.findFirst({
      where: { id, empresaId, ...notDeleted },
      include: facturaInclude,
    });
    if (!row) throw new FeNotFoundError("Factura no encontrada");
    return row;
  }

  async list(params: {
    empresaId: string;
    estado?: FeFacturaEstado;
    tipoDocumento?: import("@prisma/client").FeComprobanteTipo;
    skip: number;
    take: number;
  }) {
    const where: Prisma.FeFacturaWhereInput = {
      empresaId: params.empresaId,
      ...notDeleted,
      ...(params.estado ? { estado: params.estado } : {}),
      ...(params.tipoDocumento ? { tipoDocumento: params.tipoDocumento } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.feFactura.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { fecha: "desc" },
        include: {
          cliente: true,
          comprobante: { select: { claveNumerica: true, consecutivo: true, estadoHaciendaActual: true } },
          notasCredito: {
            where: notDeleted,
            select: { id: true, total: true, estado: true },
          },
          notasDebito: {
            where: notDeleted,
            select: { id: true, total: true, estado: true },
          },
          detalles: {
            where: notDeleted,
            select: { tarifaImpuesto: true },
          },
        },
      }),
      this.prisma.feFactura.count({ where }),
    ]);

    return { items, total };
  }

  async updateEstado(id: string, estado: FeFacturaEstado, userId?: string) {
    return this.prisma.feFactura.update({
      where: { id },
      data: { estado, updatedById: userId },
    });
  }

  async updateDraft(empresaId: string, facturaId: string, input: CreateFeFacturaInput, userId?: string) {
    const existing = await this.findById(facturaId, empresaId);
    if (!EDITABLE_ESTADOS.includes(existing.estado)) {
      throw new FeDomainError(
        "Solo se pueden editar facturas en borrador, error o pendiente de envío",
        "FE_FACTURA_NO_EDITABLE",
        400
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.feFacturaDetalle.deleteMany({ where: { facturaId } });
      return tx.feFactura.update({
        where: { id: facturaId },
        data: {
          puntoVentaId: input.puntoVentaId,
          clienteId: input.clienteId,
          tipoDocumento: input.tipoDocumento ?? "FACTURA_ELECTRONICA",
          fecha: input.fecha,
          moneda: input.moneda,
          tipoCambio: input.tipoCambio,
          condicionVenta: input.condicionVenta,
          condicionVentaOtro: input.condicionVentaOtro,
          medioPago: input.medioPago,
          medioPagoOtro: input.medioPagoOtro,
          mediosPago: input.mediosPago?.length ? input.mediosPago : undefined,
          plazoCredito: input.plazoCredito,
          observaciones: input.observaciones,
          subtotal: input.subtotal,
          totalDescuentos: input.totalDescuentos,
          totalImpuestos: input.totalImpuestos,
          totalOtrosCargos: input.totalOtrosCargos ?? 0,
          otrosCargos: input.otrosCargos?.length ? input.otrosCargos : undefined,
          totalIvaDevuelto: input.totalIvaDevuelto ?? 0,
          total: input.total,
          estado: existing.estado === "ERROR" ? "BORRADOR" : existing.estado,
          updatedById: userId,
          detalles: {
            create: input.detalles.map((line, index) => ({
              numeroLinea: index + 1,
              codigo: line.codigo,
              codigoCabys: line.codigoCabys,
              descripcion: line.descripcion,
              cantidad: line.cantidad,
              unidadMedida: line.unidadMedida,
              precioUnitario: line.precioUnitario,
              montoDescuento: line.montoDescuento,
              codigoDescuento: line.codigoDescuento ?? (Number(line.montoDescuento) > 0 ? "99" : undefined),
              naturalezaDescuento: line.naturalezaDescuento,
              codigoImpuesto: line.codigoImpuesto,
              tarifaImpuesto: line.tarifaImpuesto,
              montoImpuesto: line.montoImpuesto,
              totalLinea: line.totalLinea,
              exonTipoDocumento: line.exoneracion?.exonTipoDocumento,
              exonNumeroDocumento: line.exoneracion?.exonNumeroDocumento,
              exonNombreInstitucion: line.exoneracion?.exonNombreInstitucion,
              exonFechaEmision: line.exoneracion?.exonFechaEmision,
              exonPorcentaje: line.exoneracion?.exonPorcentaje,
              exonMonto: line.exoneracion?.exonMonto,
              ivaCobradoFabrica: line.ivaCobradoFabrica,
              impuestoAsumidoFabrica: line.impuestoAsumidoFabrica ?? 0,
              partidaArancelaria: line.partidaArancelaria,
              montoImpuestoExportacion: line.montoImpuestoExportacion,
            })),
          },
        },
        include: facturaInclude,
      });
    });
  }
}

export { facturaInclude };
