import type { Prisma, SigLegalComplianceStatus } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const legalListInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
  _count: {
    select: {
      processLinks: true,
      documentLinks: true,
      controlLinks: true,
      evidenceLinks: true,
    },
  },
} satisfies Prisma.SigLegalRequirementInclude;

const legalDetailInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
  processLinks: {
    include: { process: { select: { id: true, code: true, name: true } } },
  },
  documentLinks: {
    include: {
      document: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          documentType: { select: { code: true, name: true } },
        },
      },
    },
  },
  controlLinks: {
    include: {
      control: { select: { id: true, code: true, title: true, status: true } },
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
} satisfies Prisma.SigLegalRequirementInclude;

export type SigLegalTrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

function trimText(value: string | null | undefined, max = 4000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseOptionalDate(value: string | Date | null | undefined) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function nextLegalCode(date = new Date()) {
  const year = date.getFullYear();
  const prefix = `LEG-${year}-`;
  const latest = await prisma.sigLegalRequirement.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function computeTrafficLight(input: {
  complianceStatus: SigLegalComplianceStatus;
  nextReviewDate: Date | null;
  effectiveUntil: Date | null;
  evidenceCount: number;
}): { trafficLight: SigLegalTrafficLight; reviewOverdue: boolean; expired: boolean } {
  const now = Date.now();
  const reviewOverdue = Boolean(input.nextReviewDate && input.nextReviewDate.getTime() < now);
  const expired = Boolean(input.effectiveUntil && input.effectiveUntil.getTime() < now);

  if (input.complianceStatus === "NOT_APPLICABLE") {
    return { trafficLight: "GRAY", reviewOverdue, expired };
  }
  if (input.complianceStatus === "NON_COMPLIANT" || expired) {
    return { trafficLight: "RED", reviewOverdue, expired };
  }
  if (
    input.complianceStatus === "PARTIAL" ||
    input.complianceStatus === "NOT_EVALUATED" ||
    reviewOverdue ||
    (input.complianceStatus === "COMPLIANT" && input.evidenceCount === 0)
  ) {
    return { trafficLight: "YELLOW", reviewOverdue, expired };
  }
  return { trafficLight: "GREEN", reviewOverdue, expired };
}

export type SigLegalListItem = Prisma.SigLegalRequirementGetPayload<{
  include: typeof legalListInclude;
}> & {
  trafficLight: SigLegalTrafficLight;
  reviewOverdue: boolean;
  expired: boolean;
};

function enrichLegal<
  T extends {
    complianceStatus: SigLegalComplianceStatus;
    nextReviewDate: Date | null;
    effectiveUntil: Date | null;
    _count: { evidenceLinks: number };
  },
>(row: T): T & { trafficLight: SigLegalTrafficLight; reviewOverdue: boolean; expired: boolean } {
  return {
    ...row,
    ...computeTrafficLight({
      complianceStatus: row.complianceStatus,
      nextReviewDate: row.nextReviewDate,
      effectiveUntil: row.effectiveUntil,
      evidenceCount: row._count.evidenceLinks,
    }),
  };
}

export async function listSigLegalRequirements(input: {
  q?: string;
  processId?: string;
  complianceStatus?: SigLegalComplianceStatus;
  jurisdiction?: string;
} = {}) {
  const where: Prisma.SigLegalRequirementWhereInput = {};
  if (input.complianceStatus) where.complianceStatus = input.complianceStatus;
  if (input.jurisdiction?.trim()) {
    where.jurisdiction = { equals: input.jurisdiction.trim(), mode: "insensitive" };
  }
  if (input.processId) {
    where.OR = [
      { processId: input.processId },
      { processLinks: { some: { processId: input.processId } } },
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
          { legalSource: { contains: q, mode: "insensitive" } },
          { authority: { contains: q, mode: "insensitive" } },
          { articleRef: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const rows = await prisma.sigLegalRequirement.findMany({
    where,
    orderBy: [{ complianceStatus: "asc" }, { code: "asc" }],
    include: legalListInclude,
  });

  return rows.map((row) => enrichLegal(row));
}

export async function getSigLegalRequirementDetail(id: string) {
  const row = await prisma.sigLegalRequirement.findUnique({
    where: { id },
    include: legalDetailInclude,
  });
  if (!row) return null;
  return enrichLegal({
    ...row,
    _count: {
      evidenceLinks: row.evidenceLinks.length,
      processLinks: row.processLinks.length,
      documentLinks: row.documentLinks.length,
      controlLinks: row.controlLinks.length,
    },
  });
}

export async function createSigLegalRequirement(input: {
  title: string;
  description?: string | null;
  legalSource: string;
  authority?: string | null;
  articleRef?: string | null;
  jurisdiction?: string | null;
  processId?: string | null;
  ownerUserId?: string | null;
  complianceStatus?: SigLegalComplianceStatus;
  evaluationNotes?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  nextReviewDate?: string | null;
  processIds?: string[];
  documentIds?: string[];
  controlIds?: string[];
  evidenceIds?: string[];
  createdById: string;
}) {
  const code = await nextLegalCode();
  const complianceStatus = input.complianceStatus ?? "NOT_EVALUATED";
  const legal = await prisma.sigLegalRequirement.create({
    data: {
      code,
      title: input.title.trim().slice(0, 300),
      description: trimText(input.description),
      legalSource: input.legalSource.trim().slice(0, 400),
      authority: trimText(input.authority, 200),
      articleRef: trimText(input.articleRef, 200),
      jurisdiction: trimText(input.jurisdiction, 50) ?? "CR",
      processId: input.processId || null,
      ownerUserId: input.ownerUserId || null,
      complianceStatus,
      evaluationNotes: trimText(input.evaluationNotes),
      effectiveFrom: parseOptionalDate(input.effectiveFrom),
      effectiveUntil: parseOptionalDate(input.effectiveUntil),
      nextReviewDate: parseOptionalDate(input.nextReviewDate),
      lastEvaluatedAt: complianceStatus !== "NOT_EVALUATED" ? new Date() : null,
      createdById: input.createdById,
    },
  });

  const links: Prisma.PrismaPromise<unknown>[] = [];
  const processIds = new Set(input.processIds ?? []);
  if (input.processId) processIds.add(input.processId);
  for (const processId of processIds) {
    links.push(prisma.sigLegalProcess.create({ data: { legalId: legal.id, processId } }));
  }
  for (const documentId of input.documentIds ?? []) {
    links.push(prisma.sigLegalDocument.create({ data: { legalId: legal.id, documentId } }));
  }
  for (const controlId of input.controlIds ?? []) {
    links.push(prisma.sigLegalControl.create({ data: { legalId: legal.id, controlId } }));
  }
  for (const evidenceId of input.evidenceIds ?? []) {
    links.push(prisma.sigLegalEvidence.create({ data: { legalId: legal.id, evidenceId } }));
  }
  if (links.length) await prisma.$transaction(links);

  return getSigLegalRequirementDetail(legal.id);
}

export async function updateSigLegalRequirement(
  id: string,
  input: Partial<{
    title: string;
    description: string | null;
    legalSource: string;
    authority: string | null;
    articleRef: string | null;
    jurisdiction: string | null;
    processId: string | null;
    ownerUserId: string | null;
    complianceStatus: SigLegalComplianceStatus;
    evaluationNotes: string | null;
    effectiveFrom: string | null;
    effectiveUntil: string | null;
    nextReviewDate: string | null;
  }>
) {
  const existing = await prisma.sigLegalRequirement.findUnique({ where: { id } });
  if (!existing) throw new Error("Requisito legal no encontrado");

  const data: Prisma.SigLegalRequirementUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.description !== undefined) data.description = trimText(input.description);
  if (input.legalSource !== undefined) data.legalSource = input.legalSource.trim().slice(0, 400);
  if (input.authority !== undefined) data.authority = trimText(input.authority, 200);
  if (input.articleRef !== undefined) data.articleRef = trimText(input.articleRef, 200);
  if (input.jurisdiction !== undefined) data.jurisdiction = trimText(input.jurisdiction, 50) ?? "CR";
  if (input.processId !== undefined) {
    data.process = input.processId ? { connect: { id: input.processId } } : { disconnect: true };
  }
  if (input.ownerUserId !== undefined) {
    data.ownerUser = input.ownerUserId
      ? { connect: { id: input.ownerUserId } }
      : { disconnect: true };
  }
  if (input.complianceStatus !== undefined) {
    data.complianceStatus = input.complianceStatus;
    if (input.complianceStatus !== existing.complianceStatus) {
      data.lastEvaluatedAt = new Date();
    }
  }
  if (input.evaluationNotes !== undefined) data.evaluationNotes = trimText(input.evaluationNotes);
  if (input.effectiveFrom !== undefined) data.effectiveFrom = parseOptionalDate(input.effectiveFrom);
  if (input.effectiveUntil !== undefined) data.effectiveUntil = parseOptionalDate(input.effectiveUntil);
  if (input.nextReviewDate !== undefined) data.nextReviewDate = parseOptionalDate(input.nextReviewDate);

  await prisma.sigLegalRequirement.update({ where: { id }, data });
  return getSigLegalRequirementDetail(id);
}

export async function linkSigLegalRequirement(
  legalId: string,
  input: {
    processId?: string;
    documentId?: string;
    controlId?: string;
    evidenceId?: string;
  }
) {
  if (input.processId) {
    await prisma.sigLegalProcess.upsert({
      where: { legalId_processId: { legalId, processId: input.processId } },
      create: { legalId, processId: input.processId },
      update: {},
    });
  }
  if (input.documentId) {
    await prisma.sigLegalDocument.upsert({
      where: { legalId_documentId: { legalId, documentId: input.documentId } },
      create: { legalId, documentId: input.documentId },
      update: {},
    });
  }
  if (input.controlId) {
    await prisma.sigLegalControl.upsert({
      where: { legalId_controlId: { legalId, controlId: input.controlId } },
      create: { legalId, controlId: input.controlId },
      update: {},
    });
  }
  if (input.evidenceId) {
    await prisma.sigLegalEvidence.upsert({
      where: { legalId_evidenceId: { legalId, evidenceId: input.evidenceId } },
      create: { legalId, evidenceId: input.evidenceId },
      update: {},
    });
  }
  return getSigLegalRequirementDetail(legalId);
}

export async function unlinkSigLegalRequirement(
  legalId: string,
  input: {
    processId?: string;
    documentId?: string;
    controlId?: string;
    evidenceId?: string;
  }
) {
  if (input.processId) {
    await prisma.sigLegalProcess.delete({
      where: { legalId_processId: { legalId, processId: input.processId } },
    });
  }
  if (input.documentId) {
    await prisma.sigLegalDocument.delete({
      where: { legalId_documentId: { legalId, documentId: input.documentId } },
    });
  }
  if (input.controlId) {
    await prisma.sigLegalControl.delete({
      where: { legalId_controlId: { legalId, controlId: input.controlId } },
    });
  }
  if (input.evidenceId) {
    await prisma.sigLegalEvidence.delete({
      where: { legalId_evidenceId: { legalId, evidenceId: input.evidenceId } },
    });
  }
  return getSigLegalRequirementDetail(legalId);
}
