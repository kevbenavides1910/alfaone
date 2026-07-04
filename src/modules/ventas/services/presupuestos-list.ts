import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type { PresupuestoListInput } from "../validations/presupuesto.schema";

function n(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || null;
}

export async function listPresupuestos(input: PresupuestoListInput) {
  const where: Prisma.VentasPresupuestoWhereInput = {};

  if (input.estado) where.estado = input.estado;
  if (input.licitacionNo?.trim()) {
    where.licitacionNo = { contains: input.licitacionNo.trim(), mode: "insensitive" };
  }
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { licitacionNo: { contains: q, mode: "insensitive" } },
      { compania: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.ventasPresupuesto.count({ where }),
    prisma.ventasPresupuesto.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        oportunidad: { select: { id: true, cliente: true, estado: true } },
        _count: { select: { lineas: true } },
      },
    }),
  ]);

  return {
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    rows: rows.map((r) => ({
      id: r.id,
      oportunidadId: r.oportunidadId,
      licitacionNo: r.licitacionNo,
      compania: r.compania,
      nombre: r.nombre,
      anioBase: r.anioBase,
      estado: r.estado,
      totalMensual: n(r.totalMensual),
      totalAnual: n(r.totalAnual),
      totalConIva: n(r.totalConIva),
      lineasCount: r._count.lineas,
      oportunidad: r.oportunidad,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}
