import { prisma } from "@/modules/core/db/prisma";
import { MonthlyReportError } from "./reports";

export type MonthlyIncidentDto = {
  id: string;
  source: string;
  data: Record<string, string>;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

const MAX_COLUMNS = 40;
const MAX_KEY_LENGTH = 200;
const MAX_VALUE_LENGTH = 4000;

function normalizeSource(source: string): string {
  const value = source.trim();
  if (!value) throw new MonthlyReportError("Fuente requerida");
  if (value === "base") return value;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(value)) {
    throw new MonthlyReportError("Fuente inválida");
  }
  return value;
}

function toDto(row: {
  id: string;
  source: string;
  data: unknown;
  createdById: string;
  createdByName: string;
  createdAt: Date;
}): MonthlyIncidentDto {
  return {
    id: row.id,
    source: row.source,
    data: (row.data ?? {}) as Record<string, string>,
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listMonthlyIncidents(source: string): Promise<MonthlyIncidentDto[]> {
  const normalized = normalizeSource(source);
  const rows = await prisma.monthlyIncident.findMany({
    where: { source: normalized },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map(toDto);
}

export async function createMonthlyIncident(input: {
  source: string;
  data: Record<string, unknown>;
  userId: string;
  userName: string;
}): Promise<MonthlyIncidentDto> {
  const source = normalizeSource(input.source);

  const entries = Object.entries(input.data ?? {})
    .map(
      ([key, value]) =>
        [
          key.trim().slice(0, MAX_KEY_LENGTH),
          String(value ?? "").trim().slice(0, MAX_VALUE_LENGTH),
        ] as const,
    )
    .filter(([key, value]) => key && value);

  if (entries.length === 0) {
    throw new MonthlyReportError("Ingresá al menos un dato de la incidencia");
  }
  if (entries.length > MAX_COLUMNS) {
    throw new MonthlyReportError("La incidencia tiene demasiadas columnas");
  }

  if (source !== "base") {
    const report = await prisma.monthlyReport.findUnique({
      where: { id: source },
      select: { id: true },
    });
    if (!report) throw new MonthlyReportError("Informe no encontrado", "NOT_FOUND");
  }

  const payload = Object.fromEntries(entries);

  const row = await prisma.monthlyIncident.create({
    data: {
      source,
      data: payload,
      createdById: input.userId,
      createdByName: input.userName,
    },
  });

  return toDto(row);
}

export async function deleteMonthlyIncident(id: string): Promise<void> {
  const row = await prisma.monthlyIncident.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw new MonthlyReportError("Incidencia no encontrada", "NOT_FOUND");
  await prisma.monthlyIncident.delete({ where: { id } });
}
