import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const requirementListInclude = {
  standard: { select: { id: true, code: true, name: true, year: true } },
  parent: { select: { id: true, code: true, title: true } },
  _count: {
    select: {
      processLinks: true,
      documentLinks: true,
      evidenceLinks: true,
      findingLinks: true,
    },
  },
} satisfies Prisma.SigRequirementInclude;

const requirementDetailInclude = {
  standard: { select: { id: true, code: true, name: true, year: true } },
  parent: { select: { id: true, code: true, title: true } },
  children: {
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, title: true, isApplicable: true },
  },
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
          documentType: { select: { id: true, code: true, name: true } },
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
          validUntil: true,
          status: true,
        },
      },
    },
  },
  findingLinks: {
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      finding: {
        select: {
          id: true,
          title: true,
          findingType: true,
          status: true,
          severity: true,
          auditId: true,
        },
      },
    },
  },
} satisfies Prisma.SigRequirementInclude;

export type SigRequirementListItem = Prisma.SigRequirementGetPayload<{
  include: typeof requirementListInclude;
}> & { openNcCount: number; trafficLight: "RED" | "YELLOW" | "GREEN" | "GRAY" };

function trimText(value: string | null | undefined, max = 4000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function listSigStandards() {
  return prisma.sigStandard.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function listSigRequirements(input: {
  standardId?: string;
  q?: string;
  applicableOnly?: boolean;
} = {}) {
  const where: Prisma.SigRequirementWhereInput = {};
  if (input.standardId) where.standardId = input.standardId;
  if (input.applicableOnly) where.isApplicable = true;
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.sigRequirement.findMany({
    where,
    orderBy: [{ standard: { sortOrder: "asc" } }, { sortOrder: "asc" }, { code: "asc" }],
    include: requirementListInclude,
  });

  const requirementIds = rows.map((r) => r.id);
  const openNcGroups =
    requirementIds.length === 0
      ? []
      : await prisma.sigFindingRequirement.groupBy({
          by: ["requirementId"],
          where: {
            requirementId: { in: requirementIds },
            finding: { status: { not: "CLOSED" }, findingType: "NONCONFORMITY" },
          },
          _count: { _all: true },
        });
  const openNcMap = new Map(openNcGroups.map((g) => [g.requirementId, g._count._all]));

  return rows.map((row): SigRequirementListItem => {
    const openNcCount = openNcMap.get(row.id) ?? 0;
    let trafficLight: SigRequirementListItem["trafficLight"] = "GRAY";
    if (!row.isApplicable) trafficLight = "GRAY";
    else if (openNcCount > 0) trafficLight = "RED";
    else if (row._count.evidenceLinks > 0) trafficLight = "GREEN";
    else trafficLight = "YELLOW";
    return { ...row, openNcCount, trafficLight };
  });
}

export async function getSigRequirementDetail(id: string) {
  return prisma.sigRequirement.findUnique({
    where: { id },
    include: requirementDetailInclude,
  });
}

export async function createSigRequirement(input: {
  standardId: string;
  code: string;
  title: string;
  description?: string | null;
  parentId?: string | null;
  isApplicable?: boolean;
  sortOrder?: number;
  createdById?: string | null;
}) {
  return prisma.sigRequirement.create({
    data: {
      standardId: input.standardId,
      code: input.code.trim().slice(0, 50),
      title: input.title.trim().slice(0, 300),
      description: trimText(input.description),
      parentId: input.parentId || null,
      isApplicable: input.isApplicable ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdById: input.createdById || null,
    },
    include: requirementDetailInclude,
  });
}

export async function updateSigRequirement(
  id: string,
  input: Partial<{
    code: string;
    title: string;
    description: string | null;
    parentId: string | null;
    isApplicable: boolean;
    sortOrder: number;
  }>
) {
  const data: Prisma.SigRequirementUpdateInput = {};
  if (input.code !== undefined) data.code = input.code.trim().slice(0, 50);
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.description !== undefined) data.description = trimText(input.description);
  if (input.parentId !== undefined) {
    data.parent = input.parentId ? { connect: { id: input.parentId } } : { disconnect: true };
  }
  if (input.isApplicable !== undefined) data.isApplicable = input.isApplicable;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  return prisma.sigRequirement.update({
    where: { id },
    data,
    include: requirementDetailInclude,
  });
}

export async function linkRequirementProcess(requirementId: string, processId: string) {
  return prisma.sigRequirementProcess.upsert({
    where: { requirementId_processId: { requirementId, processId } },
    create: { requirementId, processId },
    update: {},
    include: { process: { select: { id: true, code: true, name: true } } },
  });
}

export async function unlinkRequirementProcess(requirementId: string, processId: string) {
  await prisma.sigRequirementProcess.delete({
    where: { requirementId_processId: { requirementId, processId } },
  });
}

export async function linkRequirementDocument(requirementId: string, documentId: string) {
  return prisma.sigRequirementDocument.upsert({
    where: { requirementId_documentId: { requirementId, documentId } },
    create: { requirementId, documentId },
    update: {},
    include: {
      document: {
        select: { id: true, code: true, title: true, status: true },
      },
    },
  });
}

export async function unlinkRequirementDocument(requirementId: string, documentId: string) {
  await prisma.sigRequirementDocument.delete({
    where: { requirementId_documentId: { requirementId, documentId } },
  });
}
