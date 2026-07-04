import type { Prisma, PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";
import { FeNotFoundError } from "../errors/fe-errors";
import type { CreateFeReciboPagoInput } from "../validators/recibo.schema";

export class FeReciboPagoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(empresaId: string, input: CreateFeReciboPagoInput, userId?: string) {
    return this.prisma.feReciboPago.create({
      data: {
        empresaId,
        puntoVentaId: input.puntoVentaId,
        facturaReferenciaId: input.facturaReferenciaId,
        claveReferencia: input.claveReferencia,
        codigoReferencia: input.codigoReferencia,
        tipoDocReferencia: input.tipoDocReferencia,
        fechaReferencia: input.fechaReferencia,
        razon: input.razon,
        condicionVenta: input.condicionVenta,
        medioPago: input.medioPago,
        medioPagoOtro: input.medioPagoOtro,
        subtotal: input.subtotal,
        totalImpuestos: input.totalImpuestos,
        total: input.total,
        createdById: userId,
        updatedById: userId,
        detalles: {
          create: input.detalles.map((line, index) => ({
            numeroLinea: index + 1,
            descripcion: line.descripcion,
            subTotal: line.subTotal,
            tarifaImpuesto: line.tarifaImpuesto,
            montoImpuesto: line.montoImpuesto,
            totalLinea: line.totalLinea,
          })),
        },
      },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
        facturaReferencia: { include: { cliente: true, comprobante: true } },
      },
    });
  }

  async findById(id: string, empresaId: string) {
    const row = await this.prisma.feReciboPago.findFirst({
      where: { id, empresaId, ...notDeleted },
      include: {
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: true,
        facturaReferencia: { include: { cliente: true, comprobante: true } },
      },
    });
    if (!row) throw new FeNotFoundError("Recibo de pago no encontrado");
    return row;
  }

  list(params: { empresaId: string; skip: number; take: number }) {
    const where: Prisma.FeReciboPagoWhereInput = { empresaId: params.empresaId, ...notDeleted };
    return this.prisma.$transaction([
      this.prisma.feReciboPago.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
        include: { comprobante: { select: { claveNumerica: true, estadoHaciendaActual: true } } },
      }),
      this.prisma.feReciboPago.count({ where }),
    ]);
  }

  updateEstado(id: string, estado: import("@prisma/client").FeFacturaEstado, userId?: string) {
    return this.prisma.feReciboPago.update({ where: { id }, data: { estado, updatedById: userId } });
  }
}
