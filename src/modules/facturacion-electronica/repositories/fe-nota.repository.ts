import type { FeFacturaEstado, Prisma, PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";
import { FeNotFoundError } from "../errors/fe-errors";
import type { CreateFeNotaInput } from "../validators/nota.schema";
import type { FeNotaReferenciaResuelta } from "../utils/fe-nota-referencia";
import { notaEmpresaWhere, notaReferenciaInclude } from "../utils/fe-nota-referencia";

function mapDetalles(input: CreateFeNotaInput) {
  return input.detalles.map((line, index) => ({
    numeroLinea: index + 1,
    codigo: line.codigo,
    codigoCabys: line.codigoCabys,
    descripcion: line.descripcion,
    cantidad: line.cantidad,
    unidadMedida: line.unidadMedida,
    precioUnitario: line.precioUnitario,
    montoDescuento: line.montoDescuento,
    codigoImpuesto: line.codigoImpuesto,
    tarifaImpuesto: line.tarifaImpuesto,
    montoImpuesto: line.montoImpuesto,
    totalLinea: line.totalLinea,
  }));
}

function mapNotaCreateData(ref: FeNotaReferenciaResuelta, input: CreateFeNotaInput, userId?: string) {
  return {
    referenciaTipo: input.referenciaTipo,
    facturaReferenciaId: input.facturaReferenciaId ?? null,
    facturaCompraReferenciaId: input.facturaCompraReferenciaId ?? null,
    reciboPagoReferenciaId: input.reciboPagoReferenciaId ?? null,
    claveReferencia: ref.claveReferencia,
    tipoDocReferencia: ref.tipoDocReferencia,
    codigoReferencia: input.codigoReferencia,
    razon: input.razon,
    subtotal: input.subtotal,
    totalDescuentos: input.totalDescuentos,
    totalImpuestos: input.totalImpuestos,
    total: input.total,
    createdById: userId,
    updatedById: userId,
  };
}

export class FeNotaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createCredito(ref: FeNotaReferenciaResuelta, input: CreateFeNotaInput, userId?: string) {
    return this.prisma.feNotaCredito.create({
      data: {
        ...mapNotaCreateData(ref, input, userId),
        detalles: { create: mapDetalles(input) },
      },
      include: notaCreditoInclude,
    });
  }

  async createDebito(ref: FeNotaReferenciaResuelta, input: CreateFeNotaInput, userId?: string) {
    return this.prisma.feNotaDebito.create({
      data: {
        ...mapNotaCreateData(ref, input, userId),
        detalles: { create: mapDetalles(input) },
      },
      include: notaDebitoInclude,
    });
  }

  async findCreditoById(id: string, empresaId: string) {
    const row = await this.prisma.feNotaCredito.findFirst({
      where: { id, ...notDeleted, ...notaEmpresaWhere(empresaId) },
      include: notaCreditoInclude,
    });
    if (!row) throw new FeNotFoundError("Nota de crédito no encontrada");
    return row;
  }

  async findDebitoById(id: string, empresaId: string) {
    const row = await this.prisma.feNotaDebito.findFirst({
      where: { id, ...notDeleted, ...notaEmpresaWhere(empresaId) },
      include: notaDebitoInclude,
    });
    if (!row) throw new FeNotFoundError("Nota de débito no encontrada");
    return row;
  }

  async updateCreditoEstado(id: string, estado: FeFacturaEstado, userId?: string) {
    return this.prisma.feNotaCredito.update({
      where: { id },
      data: { estado, updatedById: userId },
    });
  }

  async updateDebitoEstado(id: string, estado: FeFacturaEstado, userId?: string) {
    return this.prisma.feNotaDebito.update({
      where: { id },
      data: { estado, updatedById: userId },
    });
  }

  async listCreditoByFactura(facturaReferenciaId: string) {
    return this.prisma.feNotaCredito.findMany({
      where: { facturaReferenciaId, ...notDeleted },
      orderBy: { createdAt: "desc" },
      include: { comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } } },
    });
  }

  async listDebitoByFactura(facturaReferenciaId: string) {
    return this.prisma.feNotaDebito.findMany({
      where: { facturaReferenciaId, ...notDeleted },
      orderBy: { createdAt: "desc" },
      include: { comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } } },
    });
  }

  async listCreditoByCompra(facturaCompraReferenciaId: string) {
    return this.prisma.feNotaCredito.findMany({
      where: { facturaCompraReferenciaId, ...notDeleted },
      orderBy: { createdAt: "desc" },
      include: { comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } } },
    });
  }

  async listDebitoByCompra(facturaCompraReferenciaId: string) {
    return this.prisma.feNotaDebito.findMany({
      where: { facturaCompraReferenciaId, ...notDeleted },
      orderBy: { createdAt: "desc" },
      include: { comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } } },
    });
  }

  async listCreditoByRecibo(reciboPagoReferenciaId: string) {
    return this.prisma.feNotaCredito.findMany({
      where: { reciboPagoReferenciaId, ...notDeleted },
      orderBy: { createdAt: "desc" },
      include: { comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } } },
    });
  }

  async listDebitoByRecibo(reciboPagoReferenciaId: string) {
    return this.prisma.feNotaDebito.findMany({
      where: { reciboPagoReferenciaId, ...notDeleted },
      orderBy: { createdAt: "desc" },
      include: { comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } } },
    });
  }
}

export const notaCreditoInclude = {
  detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" as const } },
  comprobante: true,
  ...notaReferenciaInclude,
} satisfies Prisma.FeNotaCreditoInclude;

export const notaDebitoInclude = {
  detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" as const } },
  comprobante: true,
  ...notaReferenciaInclude,
} satisfies Prisma.FeNotaDebitoInclude;
