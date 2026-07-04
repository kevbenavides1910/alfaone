import type { FeComprobanteRecibidoEstado, PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";
import type { FeGastoRecibidoParsed } from "../services/incoming/gasto-recibido.parser";

export class FeGastoProveedorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByComprobanteRecibidoId(comprobanteRecibidoId: string) {
    return this.prisma.feGastoProveedor.findFirst({
      where: { comprobanteRecibidoId, ...notDeleted },
    });
  }

  createFromParsed(params: {
    empresaId: string;
    comprobanteRecibidoId: string;
    parsed: FeGastoRecibidoParsed;
    estadoRecibo: FeComprobanteRecibidoEstado;
    userId?: string;
  }) {
    const { parsed } = params;
    return this.prisma.feGastoProveedor.create({
      data: {
        empresaId: params.empresaId,
        comprobanteRecibidoId: params.comprobanteRecibidoId,
        clave: parsed.clave,
        fechaEmision: parsed.fechaEmision,
        cedulaEmisor: parsed.cedulaEmisor,
        nombreEmisor: parsed.nombreEmisor,
        tipoComprobante: parsed.tipoComprobante,
        moneda: parsed.moneda,
        tipoCambio: parsed.tipoCambio,
        subtotal: parsed.subtotal,
        totalDescuentos: parsed.totalDescuentos,
        totalImpuestos: parsed.totalImpuestos,
        total: parsed.total,
        estadoRecibo: params.estadoRecibo,
        createdById: params.userId,
        updatedById: params.userId,
        impuestos: {
          create: parsed.impuestos.map((imp) => ({
            codigoImpuesto: imp.codigoImpuesto,
            codigoTarifaIVA: imp.codigoTarifaIVA,
            tarifaPercent: imp.tarifaPercent,
            montoImpuesto: imp.montoImpuesto,
          })),
        },
      },
      include: { impuestos: true },
    });
  }

  listByFecha(params: { empresaId: string; desde: Date; hasta: Date }) {
    return this.prisma.feGastoProveedor.findMany({
      where: {
        empresaId: params.empresaId,
        ...notDeleted,
        fechaEmision: { gte: params.desde, lte: params.hasta },
      },
      include: { impuestos: { orderBy: { tarifaPercent: "asc" } } },
      orderBy: { fechaEmision: "desc" },
    });
  }

  aggregateImpuestos(params: { empresaId: string; desde: Date; hasta: Date }) {
    return this.prisma.feGastoProveedorImpuesto.groupBy({
      by: ["tarifaPercent", "codigoTarifaIVA"],
      where: {
        gasto: {
          empresaId: params.empresaId,
          ...notDeleted,
          fechaEmision: { gte: params.desde, lte: params.hasta },
        },
      },
      _sum: { montoImpuesto: true },
      orderBy: { tarifaPercent: "asc" },
    });
  }

  sumTotales(params: { empresaId: string; desde: Date; hasta: Date }) {
    return this.prisma.feGastoProveedor.aggregate({
      where: {
        empresaId: params.empresaId,
        ...notDeleted,
        fechaEmision: { gte: params.desde, lte: params.hasta },
      },
      _sum: {
        subtotal: true,
        totalDescuentos: true,
        totalImpuestos: true,
        total: true,
      },
      _count: true,
    });
  }
}
