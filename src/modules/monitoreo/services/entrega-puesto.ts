import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  entregaResultado,
  type EntregaCheck,
  type EntregaStatus,
} from "@/modules/monitoreo/business/entrega-puesto";

export type EntregaPuestoDto = {
  id: string;
  fecha: string;
  hora: string;
  saliente: string;
  entrante: string;
  observaciones: string;
  checks: EntregaCheck[];
  resultado: string;
  sourceId: string | null;
  createdByName: string;
  createdAt: string;
};

function dateToIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseFechaEntrega(fecha: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) throw new Error("Fecha inválida");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function parseChecks(value: Prisma.JsonValue): EntregaCheck[] {
  if (!Array.isArray(value)) return [];
  const out: EntregaCheck[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const status = row.status;
    if (status !== "OK" && status !== "FALLA" && status !== "NA") continue;
    if (typeof row.group !== "string" || typeof row.label !== "string") continue;
    out.push({ group: row.group, label: row.label, status: status as EntregaStatus });
  }
  return out;
}

type Row = {
  id: string;
  fecha: Date;
  hora: string;
  saliente: string;
  entrante: string;
  observaciones: string | null;
  checks: Prisma.JsonValue;
  sourceId: string | null;
  createdByName: string;
  createdAt: Date;
};

export function toEntregaDto(row: Row): EntregaPuestoDto {
  const checks = parseChecks(row.checks);
  return {
    id: row.id,
    fecha: dateToIso(row.fecha),
    hora: row.hora,
    saliente: row.saliente,
    entrante: row.entrante,
    observaciones: row.observaciones ?? "",
    checks,
    resultado: entregaResultado(checks),
    sourceId: row.sourceId,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listEntregasPuesto(opts: { limit?: number; desde?: string; hasta?: string }) {
  const take = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const where: Prisma.BandecoEntregaPuestoWhereInput = {};
  if (opts.desde || opts.hasta) {
    where.fecha = {
      ...(opts.desde ? { gte: parseFechaEntrega(opts.desde) } : {}),
      ...(opts.hasta ? { lte: parseFechaEntrega(opts.hasta) } : {}),
    };
  }
  const rows = await prisma.bandecoEntregaPuesto.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take,
  });
  return rows.map(toEntregaDto);
}

export async function crearEntregaPuesto(input: {
  fecha: string;
  hora: string;
  saliente: string;
  entrante: string;
  observaciones: string;
  checks: EntregaCheck[];
  sourceId?: string;
  createdAt?: string;
  createdById?: string | null;
  createdByName: string;
}) {
  if (input.sourceId) {
    const existing = await prisma.bandecoEntregaPuesto.findUnique({
      where: { sourceId: input.sourceId },
    });
    if (existing) return { row: toEntregaDto(existing), duplicated: true as const };
  }

  const createdAt = input.createdAt ? new Date(input.createdAt) : undefined;
  const row = await prisma.bandecoEntregaPuesto.create({
    data: {
      fecha: parseFechaEntrega(input.fecha),
      hora: input.hora,
      saliente: input.saliente.trim(),
      entrante: input.entrante.trim(),
      observaciones: input.observaciones.trim() || null,
      checks: input.checks,
      sourceId: input.sourceId ?? null,
      createdById: input.createdById ?? null,
      createdByName: input.createdByName,
      ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { createdAt } : {}),
    },
  });
  return { row: toEntregaDto(row), duplicated: false as const };
}

export async function getEntregaPuesto(id: string) {
  const row = await prisma.bandecoEntregaPuesto.findUnique({ where: { id } });
  return row ? toEntregaDto(row) : null;
}

export async function eliminarEntregaPuesto(id: string) {
  const existing = await prisma.bandecoEntregaPuesto.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.bandecoEntregaPuesto.delete({ where: { id } });
  return true;
}

export async function importarEntregasPuesto(
  rows: Array<{
    fecha: string;
    hora: string;
    saliente: string;
    entrante: string;
    observaciones: string;
    checks: EntregaCheck[];
    sourceId?: string;
    createdAt?: string;
  }>,
  actor: { createdById?: string | null; createdByName: string },
) {
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const result = await crearEntregaPuesto({ ...row, ...actor });
    if (result.duplicated) skipped += 1;
    else inserted += 1;
  }
  return { inserted, skipped };
}
