import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type { OportunidadListInput } from "../validations/oportunidad.schema";

export type OportunidadRow = {
  id: string;
  licitacionNo: string;
  cliente: string;
  descripcion: string;
  fechaPresentacion: string;
  enlace: string | null;
  estado: string;
  source: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  createdAt: string;
  updatedAt: string;
  inicioRecepcion: string | null;
  cierreRecepcion: string | null;
  montoContratacion: string | null;
  monedaContratacion: string | null;
  fechaAclaracion: string | null;
  fechaObjeciones: string | null;
  sicopUpdatedAt: string | null;
};

function toRow(row: {
  id: string;
  licitacionNo: string;
  cliente: string;
  descripcion: string;
  fechaPresentacion: Date;
  enlace: string | null;
  estado: string;
  source: string | null;
  decidedAt: Date | null;
  decidedBy: { name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  inicioRecepcion: Date | null;
  cierreRecepcion: Date | null;
  montoContratacion: any | null;
  monedaContratacion: string | null;
  fechaAclaracion: Date | null;
  fechaObjeciones: Date | null;
  sicopUpdatedAt: Date | null;
}): OportunidadRow {
  return {
    id: row.id,
    licitacionNo: row.licitacionNo,
    cliente: row.cliente,
    descripcion: row.descripcion,
    fechaPresentacion: row.fechaPresentacion.toISOString(),
    enlace: row.enlace,
    estado: row.estado,
    source: row.source,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByName: row.decidedBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    inicioRecepcion: row.inicioRecepcion?.toISOString() ?? null,
    cierreRecepcion: row.cierreRecepcion?.toISOString() ?? null,
    montoContratacion: row.montoContratacion?.toString() ?? null,
    monedaContratacion: row.monedaContratacion ?? null,
    fechaAclaracion: row.fechaAclaracion?.toISOString() ?? null,
    fechaObjeciones: row.fechaObjeciones?.toISOString() ?? null,
    sicopUpdatedAt: row.sicopUpdatedAt?.toISOString() ?? null,
  };
}

export async function listOportunidades(input: OportunidadListInput) {
  const where: Prisma.VentasOportunidadWhereInput = {};

  if (input.estado) where.estado = input.estado;

  if (input.licitacionNo?.trim()) {
    where.licitacionNo = { contains: input.licitacionNo.trim(), mode: "insensitive" };
  }

  if (input.cliente?.trim()) {
    where.cliente = { contains: input.cliente.trim(), mode: "insensitive" };
  }

  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { licitacionNo: { contains: q, mode: "insensitive" } },
      { cliente: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
    ];
  }

  if (input.fechaDesde || input.fechaHasta) {
    where.fechaPresentacion = {};
    if (input.fechaDesde) {
      where.fechaPresentacion.gte = new Date(`${input.fechaDesde}T00:00:00.000Z`);
    }
    if (input.fechaHasta) {
      where.fechaPresentacion.lte = new Date(`${input.fechaHasta}T23:59:59.999Z`);
    }
  }

  const [total, rows, resumenEstado] = await Promise.all([
    prisma.ventasOportunidad.count({ where }),
    prisma.ventasOportunidad.findMany({
      where,
      orderBy: [{ fechaPresentacion: "asc" }, { createdAt: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: { decidedBy: { select: { name: true } } },
    }),
    prisma.ventasOportunidad.groupBy({
      by: ["estado"],
      _count: { _all: true },
    }),
  ]);

  return {
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    rows: rows.map(toRow),
    resumenEstado: Object.fromEntries(
      resumenEstado.map((r) => [r.estado, r._count._all])
    ) as Record<string, number>,
  };
}
