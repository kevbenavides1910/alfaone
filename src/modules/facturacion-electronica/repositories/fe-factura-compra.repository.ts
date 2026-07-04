import type { Prisma, PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";
import { FeNotFoundError } from "../errors/fe-errors";
import type { CreateFeFacturaCompraInput } from "../validators/compra.schema";

export class FeFacturaCompraRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(empresaId: string, input: CreateFeFacturaCompraInput, userId?: string) {
    return this.prisma.feFacturaCompra.create({
      data: {
        empresaId,
        puntoVentaId: input.puntoVentaId,
        fecha: input.fecha,
        moneda: input.moneda,
        tipoCambio: input.tipoCambio,
        condicionVenta: input.condicionVenta,
        proveedorTipoIdentificacion: input.proveedorTipoIdentificacion,
        proveedorIdentificacion: input.proveedorIdentificacion,
        proveedorNombre: input.proveedorNombre,
        proveedorOtrasSenasExtranjero: input.proveedorOtrasSenasExtranjero,
        claveReferencia: input.claveReferencia,
        subtotal: input.subtotal,
        totalDescuentos: input.totalDescuentos,
        totalImpuestos: input.totalImpuestos,
        total: input.total,
        observaciones: input.observaciones,
        createdById: userId,
        updatedById: userId,
        detalles: {
          create: input.detalles.map((line, index) => ({
            numeroLinea: index + 1,
            codigoCabys: line.codigoCabys,
            descripcion: line.descripcion,
            cantidad: line.cantidad,
            unidadMedida: line.unidadMedida,
            precioUnitario: line.precioUnitario,
            montoDescuento: line.montoDescuento,
            tarifaImpuesto: line.tarifaImpuesto,
            montoImpuesto: line.montoImpuesto,
            totalLinea: line.totalLinea,
          })),
        },
      },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
      },
    });
  }

  async findById(id: string, empresaId: string) {
    const row = await this.prisma.feFacturaCompra.findFirst({
      where: { id, empresaId, ...notDeleted },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
      },
    });
    if (!row) throw new FeNotFoundError("Factura de compra no encontrada");
    return row;
  }

  list(params: { empresaId: string; skip: number; take: number }) {
    const where: Prisma.FeFacturaCompraWhereInput = { empresaId: params.empresaId, ...notDeleted };
    return this.prisma.$transaction([
      this.prisma.feFacturaCompra.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { fecha: "desc" },
        include: { comprobante: { select: { claveNumerica: true, estadoHaciendaActual: true } } },
      }),
      this.prisma.feFacturaCompra.count({ where }),
    ]);
  }

  updateEstado(id: string, estado: import("@prisma/client").FeFacturaEstado, userId?: string) {
    return this.prisma.feFacturaCompra.update({ where: { id }, data: { estado, updatedById: userId } });
  }
}
