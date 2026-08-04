import type {
  Prisma,
  SigIndicatorDirection,
  SigIndicatorFrequency,
  SigIndicatorStatus,
} from "@prisma/client";
import { Prisma as PrismaNS } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const indicatorListInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
  measurements: {
    orderBy: { periodStart: "desc" },
    take: 1,
    select: {
      id: true,
      value: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
    },
  },
  _count: { select: { measurements: true, processLinks: true } },
} satisfies Prisma.SigIndicatorInclude;

const indicatorDetailInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
  processLinks: {
    include: { process: { select: { id: true, code: true, name: true } } },
  },
  measurements: {
    orderBy: { periodStart: "desc" },
    take: 40,
    include: {
      recordedBy: { select: userSelect },
      evidence: { select: { id: true, code: true, description: true } },
    },
  },
} satisfies Prisma.SigIndicatorInclude;

export type SigIndicatorTrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

function trimText(value: string | null | undefined, max = 4000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseOptionalDate(value: string | Date | null | undefined) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value: PrismaNS.Decimal | number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  return Number(value);
}

function toDecimal(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return new PrismaNS.Decimal(value);
}

async function nextIndicatorCode(date = new Date()) {
  const year = date.getFullYear();
  const prefix = `IND-${year}-`;
  const latest = await prisma.sigIndicator.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function frequencyDays(frequency: SigIndicatorFrequency) {
  switch (frequency) {
    case "WEEKLY":
      return 7;
    case "MONTHLY":
      return 31;
    case "QUARTERLY":
      return 92;
    case "ANNUAL":
      return 366;
    default:
      return null;
  }
}

export function evaluateIndicatorLight(input: {
  direction: SigIndicatorDirection;
  status: SigIndicatorStatus;
  frequency: SigIndicatorFrequency;
  targetValue: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  latestValue: number | null;
  latestPeriodStart: Date | null;
}): { trafficLight: SigIndicatorTrafficLight; measurementOverdue: boolean } {
  if (input.status === "INACTIVE") {
    return { trafficLight: "GRAY", measurementOverdue: false };
  }

  const days = frequencyDays(input.frequency);
  const measurementOverdue = Boolean(
    days &&
      input.latestPeriodStart &&
      Date.now() - input.latestPeriodStart.getTime() > days * 24 * 60 * 60 * 1000
  );

  if (input.latestValue == null || input.targetValue == null) {
    return {
      trafficLight: measurementOverdue ? "YELLOW" : "GRAY",
      measurementOverdue,
    };
  }

  const value = input.latestValue;
  const target = input.targetValue;
  const warning = input.warningThreshold;
  const critical = input.criticalThreshold;

  let light: SigIndicatorTrafficLight = "GREEN";

  if (input.direction === "HIGHER_BETTER") {
    if (critical != null && value <= critical) light = "RED";
    else if (warning != null && value <= warning) light = "YELLOW";
    else if (value < target) light = warning != null || critical != null ? "YELLOW" : "RED";
    else light = "GREEN";
  } else {
    if (critical != null && value >= critical) light = "RED";
    else if (warning != null && value >= warning) light = "YELLOW";
    else if (value > target) light = warning != null || critical != null ? "YELLOW" : "RED";
    else light = "GREEN";
  }

  if (measurementOverdue && light === "GREEN") light = "YELLOW";

  return { trafficLight: light, measurementOverdue };
}

function enrichIndicator<
  T extends {
    direction: SigIndicatorDirection;
    status: SigIndicatorStatus;
    frequency: SigIndicatorFrequency;
    targetValue: PrismaNS.Decimal | number | null;
    warningThreshold: PrismaNS.Decimal | number | null;
    criticalThreshold: PrismaNS.Decimal | number | null;
    measurements: Array<{
      value: PrismaNS.Decimal | number;
      periodStart: Date;
    }>;
  },
>(row: T) {
  const latest = row.measurements[0] ?? null;
  const evaluation = evaluateIndicatorLight({
    direction: row.direction,
    status: row.status,
    frequency: row.frequency,
    targetValue: toNumber(row.targetValue),
    warningThreshold: toNumber(row.warningThreshold),
    criticalThreshold: toNumber(row.criticalThreshold),
    latestValue: latest ? toNumber(latest.value) : null,
    latestPeriodStart: latest?.periodStart ?? null,
  });
  return {
    ...row,
    latestMeasurement: latest,
    latestValue: latest ? toNumber(latest.value) : null,
    ...evaluation,
  };
}

export async function listSigIndicators(input: {
  q?: string;
  processId?: string;
  status?: SigIndicatorStatus;
} = {}) {
  const where: Prisma.SigIndicatorWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.processId) {
    where.OR = [
      { processId: input.processId },
      { processLinks: { some: { processId: input.processId } } },
    ];
  }
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.AND = [
      {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { unit: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const rows = await prisma.sigIndicator.findMany({
    where,
    orderBy: [{ code: "asc" }],
    include: indicatorListInclude,
  });

  return rows.map((row) => enrichIndicator(row));
}

export async function getSigIndicatorDetail(id: string) {
  const row = await prisma.sigIndicator.findUnique({
    where: { id },
    include: indicatorDetailInclude,
  });
  return row ? enrichIndicator(row) : null;
}

export async function createSigIndicator(input: {
  title: string;
  description?: string | null;
  processId?: string | null;
  ownerUserId?: string | null;
  unit?: string | null;
  direction?: SigIndicatorDirection;
  frequency?: SigIndicatorFrequency;
  targetValue?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  status?: SigIndicatorStatus;
  formulaNotes?: string | null;
  processIds?: string[];
  createdById: string;
}) {
  const code = await nextIndicatorCode();
  const indicator = await prisma.sigIndicator.create({
    data: {
      code,
      title: input.title.trim().slice(0, 300),
      description: trimText(input.description),
      processId: input.processId || null,
      ownerUserId: input.ownerUserId || null,
      unit: trimText(input.unit, 40),
      direction: input.direction ?? "HIGHER_BETTER",
      frequency: input.frequency ?? "MONTHLY",
      targetValue: toDecimal(input.targetValue ?? null),
      warningThreshold: toDecimal(input.warningThreshold ?? null),
      criticalThreshold: toDecimal(input.criticalThreshold ?? null),
      status: input.status ?? "ACTIVE",
      formulaNotes: trimText(input.formulaNotes),
      createdById: input.createdById,
    },
  });

  const processIds = new Set(input.processIds ?? []);
  if (input.processId) processIds.add(input.processId);
  if (processIds.size) {
    await prisma.sigIndicatorProcess.createMany({
      data: [...processIds].map((processId) => ({ indicatorId: indicator.id, processId })),
      skipDuplicates: true,
    });
  }

  return getSigIndicatorDetail(indicator.id);
}

export async function updateSigIndicator(
  id: string,
  input: Partial<{
    title: string;
    description: string | null;
    processId: string | null;
    ownerUserId: string | null;
    unit: string | null;
    direction: SigIndicatorDirection;
    frequency: SigIndicatorFrequency;
    targetValue: number | null;
    warningThreshold: number | null;
    criticalThreshold: number | null;
    status: SigIndicatorStatus;
    formulaNotes: string | null;
  }>
) {
  const existing = await prisma.sigIndicator.findUnique({ where: { id } });
  if (!existing) throw new Error("Indicador no encontrado");

  const data: Prisma.SigIndicatorUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.description !== undefined) data.description = trimText(input.description);
  if (input.processId !== undefined) {
    data.process = input.processId ? { connect: { id: input.processId } } : { disconnect: true };
  }
  if (input.ownerUserId !== undefined) {
    data.ownerUser = input.ownerUserId
      ? { connect: { id: input.ownerUserId } }
      : { disconnect: true };
  }
  if (input.unit !== undefined) data.unit = trimText(input.unit, 40);
  if (input.direction !== undefined) data.direction = input.direction;
  if (input.frequency !== undefined) data.frequency = input.frequency;
  if (input.targetValue !== undefined) data.targetValue = toDecimal(input.targetValue);
  if (input.warningThreshold !== undefined) data.warningThreshold = toDecimal(input.warningThreshold);
  if (input.criticalThreshold !== undefined) {
    data.criticalThreshold = toDecimal(input.criticalThreshold);
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.formulaNotes !== undefined) data.formulaNotes = trimText(input.formulaNotes);

  await prisma.sigIndicator.update({ where: { id }, data });
  return getSigIndicatorDetail(id);
}

export async function createSigIndicatorMeasurement(
  indicatorId: string,
  input: {
    periodStart: string;
    periodEnd?: string | null;
    value: number;
    notes?: string | null;
    evidenceId?: string | null;
    recordedById: string;
  }
) {
  const indicator = await prisma.sigIndicator.findUnique({ where: { id: indicatorId } });
  if (!indicator) throw new Error("Indicador no encontrado");
  if (indicator.status === "INACTIVE") throw new Error("El indicador está inactivo");

  const periodStart = parseOptionalDate(input.periodStart);
  if (!periodStart) throw new Error("Fecha de periodo requerida");

  await prisma.sigIndicatorMeasurement.create({
    data: {
      indicatorId,
      periodStart,
      periodEnd: parseOptionalDate(input.periodEnd),
      value: new PrismaNS.Decimal(input.value),
      notes: trimText(input.notes),
      evidenceId: input.evidenceId || null,
      recordedById: input.recordedById,
    },
  });

  return getSigIndicatorDetail(indicatorId);
}

export async function deleteSigIndicatorMeasurement(measurementId: string) {
  const measurement = await prisma.sigIndicatorMeasurement.findUnique({
    where: { id: measurementId },
    select: { id: true, indicatorId: true },
  });
  if (!measurement) throw new Error("Medición no encontrada");
  await prisma.sigIndicatorMeasurement.delete({ where: { id: measurementId } });
  return getSigIndicatorDetail(measurement.indicatorId);
}
