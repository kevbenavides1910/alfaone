import type { Prisma, SigRiskKind, SigRiskStatus } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const riskListInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
  _count: {
    select: {
      processLinks: true,
      controlLinks: true,
      requirementLinks: true,
      evidenceLinks: true,
    },
  },
} satisfies Prisma.SigRiskInclude;

const riskDetailInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
  processLinks: {
    include: { process: { select: { id: true, code: true, name: true } } },
  },
  controlLinks: {
    include: {
      control: { select: { id: true, code: true, title: true, status: true } },
    },
  },
  requirementLinks: {
    include: {
      requirement: {
        select: {
          id: true,
          code: true,
          title: true,
          standard: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
  evidenceLinks: {
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      evidence: {
        select: {
          id: true,
          code: true,
          type: true,
          description: true,
          evidenceDate: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.SigRiskInclude;

export type SigRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export function scoreToLevel(score: number): SigRiskLevel {
  if (score >= 16) return "CRITICAL";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MEDIUM";
  return "LOW";
}

function trimText(value: string | null | undefined, max = 4000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function clampScale(value: number | null | undefined, fallback = 3) {
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function parseOptionalDate(value: string | Date | null | undefined) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function nextRiskCode(date = new Date()) {
  const year = date.getFullYear();
  const prefix = `RSK-${year}-`;
  const latest = await prisma.sigRisk.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export type SigRiskListItem = Prisma.SigRiskGetPayload<{ include: typeof riskListInclude }> & {
  inherentLevel: SigRiskLevel;
  residualLevel: SigRiskLevel | null;
  reviewOverdue: boolean;
};

function enrichRisk<T extends { inherentScore: number; residualScore: number | null; nextReviewDate: Date | null; status: SigRiskStatus }>(
  row: T
): T & { inherentLevel: SigRiskLevel; residualLevel: SigRiskLevel | null; reviewOverdue: boolean } {
  const now = Date.now();
  return {
    ...row,
    inherentLevel: scoreToLevel(row.inherentScore),
    residualLevel: row.residualScore != null ? scoreToLevel(row.residualScore) : null,
    reviewOverdue:
      row.status !== "CLOSED" &&
      Boolean(row.nextReviewDate && row.nextReviewDate.getTime() < now),
  };
}

export async function listSigRisks(input: {
  q?: string;
  processId?: string;
  kind?: SigRiskKind;
  status?: SigRiskStatus;
  minScore?: number;
} = {}) {
  const where: Prisma.SigRiskWhereInput = {};
  if (input.kind) where.kind = input.kind;
  if (input.status) where.status = input.status;
  if (input.minScore != null) {
    where.OR = [
      { residualScore: { gte: input.minScore } },
      { residualScore: null, inherentScore: { gte: input.minScore } },
    ];
  }
  if (input.processId) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { processId: input.processId },
          { processLinks: { some: { processId: input.processId } } },
        ],
      },
    ];
  }
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { treatment: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const rows = await prisma.sigRisk.findMany({
    where,
    orderBy: [{ inherentScore: "desc" }, { code: "asc" }],
    include: riskListInclude,
  });

  return rows.map((row) => enrichRisk(row));
}

export async function getSigRiskDetail(id: string) {
  const row = await prisma.sigRisk.findUnique({
    where: { id },
    include: riskDetailInclude,
  });
  return row ? enrichRisk(row) : null;
}

export async function createSigRisk(input: {
  title: string;
  description?: string | null;
  kind?: SigRiskKind;
  status?: SigRiskStatus;
  processId?: string | null;
  ownerUserId?: string | null;
  likelihood?: number;
  impact?: number;
  residualLikelihood?: number | null;
  residualImpact?: number | null;
  treatment?: string | null;
  reviewDate?: string | null;
  nextReviewDate?: string | null;
  processIds?: string[];
  controlIds?: string[];
  requirementIds?: string[];
  evidenceIds?: string[];
  createdById: string;
}) {
  const likelihood = clampScale(input.likelihood, 3);
  const impact = clampScale(input.impact, 3);
  const inherentScore = likelihood * impact;

  const residualLikelihood =
    input.residualLikelihood == null ? null : clampScale(input.residualLikelihood);
  const residualImpact = input.residualImpact == null ? null : clampScale(input.residualImpact);
  const residualScore =
    residualLikelihood != null && residualImpact != null
      ? residualLikelihood * residualImpact
      : null;

  const code = await nextRiskCode();
  const risk = await prisma.sigRisk.create({
    data: {
      code,
      title: input.title.trim().slice(0, 300),
      description: trimText(input.description),
      kind: input.kind ?? "RISK",
      status: input.status ?? "IDENTIFIED",
      processId: input.processId || null,
      ownerUserId: input.ownerUserId || null,
      likelihood,
      impact,
      inherentScore,
      residualLikelihood,
      residualImpact,
      residualScore,
      treatment: trimText(input.treatment),
      reviewDate: parseOptionalDate(input.reviewDate),
      nextReviewDate: parseOptionalDate(input.nextReviewDate),
      createdById: input.createdById,
    },
  });

  const links: Prisma.PrismaPromise<unknown>[] = [];
  const processIds = new Set(input.processIds ?? []);
  if (input.processId) processIds.add(input.processId);
  for (const processId of processIds) {
    links.push(prisma.sigRiskProcess.create({ data: { riskId: risk.id, processId } }));
  }
  for (const controlId of input.controlIds ?? []) {
    links.push(prisma.sigRiskControl.create({ data: { riskId: risk.id, controlId } }));
  }
  for (const requirementId of input.requirementIds ?? []) {
    links.push(prisma.sigRiskRequirement.create({ data: { riskId: risk.id, requirementId } }));
  }
  for (const evidenceId of input.evidenceIds ?? []) {
    links.push(prisma.sigRiskEvidence.create({ data: { riskId: risk.id, evidenceId } }));
  }
  if (links.length) await prisma.$transaction(links);

  return getSigRiskDetail(risk.id);
}

export async function updateSigRisk(
  id: string,
  input: Partial<{
    title: string;
    description: string | null;
    kind: SigRiskKind;
    status: SigRiskStatus;
    processId: string | null;
    ownerUserId: string | null;
    likelihood: number;
    impact: number;
    residualLikelihood: number | null;
    residualImpact: number | null;
    treatment: string | null;
    reviewDate: string | null;
    nextReviewDate: string | null;
  }>
) {
  const existing = await prisma.sigRisk.findUnique({ where: { id } });
  if (!existing) throw new Error("Riesgo no encontrado");

  const likelihood =
    input.likelihood !== undefined ? clampScale(input.likelihood) : existing.likelihood;
  const impact = input.impact !== undefined ? clampScale(input.impact) : existing.impact;
  const inherentScore = likelihood * impact;

  let residualLikelihood = existing.residualLikelihood;
  let residualImpact = existing.residualImpact;
  if (input.residualLikelihood !== undefined) {
    residualLikelihood =
      input.residualLikelihood == null ? null : clampScale(input.residualLikelihood);
  }
  if (input.residualImpact !== undefined) {
    residualImpact = input.residualImpact == null ? null : clampScale(input.residualImpact);
  }
  const residualScore =
    residualLikelihood != null && residualImpact != null
      ? residualLikelihood * residualImpact
      : null;

  const data: Prisma.SigRiskUpdateInput = {
    likelihood,
    impact,
    inherentScore,
    residualLikelihood,
    residualImpact,
    residualScore,
  };
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.description !== undefined) data.description = trimText(input.description);
  if (input.kind !== undefined) data.kind = input.kind;
  if (input.status !== undefined) data.status = input.status;
  if (input.processId !== undefined) {
    data.process = input.processId ? { connect: { id: input.processId } } : { disconnect: true };
  }
  if (input.ownerUserId !== undefined) {
    data.ownerUser = input.ownerUserId
      ? { connect: { id: input.ownerUserId } }
      : { disconnect: true };
  }
  if (input.treatment !== undefined) data.treatment = trimText(input.treatment);
  if (input.reviewDate !== undefined) data.reviewDate = parseOptionalDate(input.reviewDate);
  if (input.nextReviewDate !== undefined) {
    data.nextReviewDate = parseOptionalDate(input.nextReviewDate);
  }

  await prisma.sigRisk.update({ where: { id }, data });
  return getSigRiskDetail(id);
}

export async function linkSigRisk(
  riskId: string,
  input: {
    processId?: string;
    controlId?: string;
    requirementId?: string;
    evidenceId?: string;
  }
) {
  if (input.processId) {
    await prisma.sigRiskProcess.upsert({
      where: { riskId_processId: { riskId, processId: input.processId } },
      create: { riskId, processId: input.processId },
      update: {},
    });
  }
  if (input.controlId) {
    await prisma.sigRiskControl.upsert({
      where: { riskId_controlId: { riskId, controlId: input.controlId } },
      create: { riskId, controlId: input.controlId },
      update: {},
    });
  }
  if (input.requirementId) {
    await prisma.sigRiskRequirement.upsert({
      where: { riskId_requirementId: { riskId, requirementId: input.requirementId } },
      create: { riskId, requirementId: input.requirementId },
      update: {},
    });
  }
  if (input.evidenceId) {
    await prisma.sigRiskEvidence.upsert({
      where: { riskId_evidenceId: { riskId, evidenceId: input.evidenceId } },
      create: { riskId, evidenceId: input.evidenceId },
      update: {},
    });
  }
  return getSigRiskDetail(riskId);
}

export async function unlinkSigRisk(
  riskId: string,
  input: {
    processId?: string;
    controlId?: string;
    requirementId?: string;
    evidenceId?: string;
  }
) {
  if (input.processId) {
    await prisma.sigRiskProcess.delete({
      where: { riskId_processId: { riskId, processId: input.processId } },
    });
  }
  if (input.controlId) {
    await prisma.sigRiskControl.delete({
      where: { riskId_controlId: { riskId, controlId: input.controlId } },
    });
  }
  if (input.requirementId) {
    await prisma.sigRiskRequirement.delete({
      where: { riskId_requirementId: { riskId, requirementId: input.requirementId } },
    });
  }
  if (input.evidenceId) {
    await prisma.sigRiskEvidence.delete({
      where: { riskId_evidenceId: { riskId, evidenceId: input.evidenceId } },
    });
  }
  return getSigRiskDetail(riskId);
}
