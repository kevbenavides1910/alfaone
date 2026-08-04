import type { Prisma, SigControlStatus } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const controlListInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
  _count: {
    select: {
      requirementLinks: true,
      processLinks: true,
      documentLinks: true,
      evidenceLinks: true,
    },
  },
} satisfies Prisma.SigControlInclude;

const controlDetailInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
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
} satisfies Prisma.SigControlInclude;

function trimText(value: string | null | undefined, max = 4000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

async function nextControlCode(date = new Date()) {
  const year = date.getFullYear();
  const prefix = `CTRL-${year}-`;
  const latest = await prisma.sigControl.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export type SigControlListItem = Prisma.SigControlGetPayload<{
  include: typeof controlListInclude;
}> & {
  latestEvidenceDate: Date | null;
  freshness: "OK" | "DUE_SOON" | "OVERDUE" | "NO_EVIDENCE" | "INACTIVE";
};

export async function listSigControls(input: {
  q?: string;
  processId?: string;
  status?: SigControlStatus;
  requirementId?: string;
} = {}) {
  const where: Prisma.SigControlWhereInput = {};
  if (input.processId) {
    where.OR = [
      { processId: input.processId },
      { processLinks: { some: { processId: input.processId } } },
    ];
  }
  if (input.status) where.status = input.status;
  if (input.requirementId) {
    where.requirementLinks = { some: { requirementId: input.requirementId } };
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
        ],
      },
    ];
  }

  const rows = await prisma.sigControl.findMany({
    where,
    orderBy: [{ code: "asc" }],
    include: controlListInclude,
  });

  const controlIds = rows.map((r) => r.id);
  const latestByControl = new Map<string, Date>();
  if (controlIds.length) {
    const links = await prisma.sigControlEvidence.findMany({
      where: { controlId: { in: controlIds } },
      include: { evidence: { select: { evidenceDate: true } } },
    });
    for (const link of links) {
      const current = latestByControl.get(link.controlId);
      if (!current || link.evidence.evidenceDate > current) {
        latestByControl.set(link.controlId, link.evidence.evidenceDate);
      }
    }
  }

  const now = Date.now();
  return rows.map((row): SigControlListItem => {
    const latestEvidenceDate = latestByControl.get(row.id) ?? null;
    let freshness: SigControlListItem["freshness"] = "NO_EVIDENCE";
    if (row.status !== "ACTIVE") freshness = "INACTIVE";
    else if (!latestEvidenceDate) freshness = "NO_EVIDENCE";
    else if (row.evidenceIntervalDays) {
      const ageDays = (now - latestEvidenceDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > row.evidenceIntervalDays) freshness = "OVERDUE";
      else if (ageDays > row.evidenceIntervalDays * 0.8) freshness = "DUE_SOON";
      else freshness = "OK";
    } else {
      freshness = "OK";
    }
    return { ...row, latestEvidenceDate, freshness };
  });
}

export async function getSigControlDetail(id: string) {
  return prisma.sigControl.findUnique({
    where: { id },
    include: controlDetailInclude,
  });
}

export async function createSigControl(input: {
  title: string;
  description?: string | null;
  status?: SigControlStatus;
  processId?: string | null;
  ownerUserId?: string | null;
  evidenceIntervalDays?: number | null;
  requirementIds?: string[];
  processIds?: string[];
  documentIds?: string[];
  createdById: string;
}) {
  const code = await nextControlCode();
  const control = await prisma.sigControl.create({
    data: {
      code,
      title: input.title.trim().slice(0, 300),
      description: trimText(input.description),
      status: input.status ?? "ACTIVE",
      processId: input.processId || null,
      ownerUserId: input.ownerUserId || null,
      evidenceIntervalDays: input.evidenceIntervalDays ?? null,
      createdById: input.createdById,
    },
  });

  const links: Prisma.PrismaPromise<unknown>[] = [];
  for (const requirementId of input.requirementIds ?? []) {
    links.push(
      prisma.sigControlRequirement.create({ data: { controlId: control.id, requirementId } })
    );
  }
  const processIds = new Set(input.processIds ?? []);
  if (input.processId) processIds.add(input.processId);
  for (const processId of processIds) {
    links.push(prisma.sigControlProcess.create({ data: { controlId: control.id, processId } }));
  }
  for (const documentId of input.documentIds ?? []) {
    links.push(prisma.sigControlDocument.create({ data: { controlId: control.id, documentId } }));
  }
  if (links.length) await prisma.$transaction(links);

  return getSigControlDetail(control.id);
}

export async function updateSigControl(
  id: string,
  input: Partial<{
    title: string;
    description: string | null;
    status: SigControlStatus;
    processId: string | null;
    ownerUserId: string | null;
    evidenceIntervalDays: number | null;
  }>
) {
  const data: Prisma.SigControlUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.description !== undefined) data.description = trimText(input.description);
  if (input.status !== undefined) data.status = input.status;
  if (input.processId !== undefined) {
    data.process = input.processId ? { connect: { id: input.processId } } : { disconnect: true };
  }
  if (input.ownerUserId !== undefined) {
    data.ownerUser = input.ownerUserId
      ? { connect: { id: input.ownerUserId } }
      : { disconnect: true };
  }
  if (input.evidenceIntervalDays !== undefined) {
    data.evidenceIntervalDays = input.evidenceIntervalDays;
  }
  await prisma.sigControl.update({ where: { id }, data });
  return getSigControlDetail(id);
}

export async function linkSigControl(
  controlId: string,
  input: {
    requirementId?: string;
    processId?: string;
    documentId?: string;
    evidenceId?: string;
  }
) {
  if (input.requirementId) {
    await prisma.sigControlRequirement.upsert({
      where: {
        controlId_requirementId: { controlId, requirementId: input.requirementId },
      },
      create: { controlId, requirementId: input.requirementId },
      update: {},
    });
  }
  if (input.processId) {
    await prisma.sigControlProcess.upsert({
      where: { controlId_processId: { controlId, processId: input.processId } },
      create: { controlId, processId: input.processId },
      update: {},
    });
  }
  if (input.documentId) {
    await prisma.sigControlDocument.upsert({
      where: { controlId_documentId: { controlId, documentId: input.documentId } },
      create: { controlId, documentId: input.documentId },
      update: {},
    });
  }
  if (input.evidenceId) {
    await prisma.sigControlEvidence.upsert({
      where: { controlId_evidenceId: { controlId, evidenceId: input.evidenceId } },
      create: { controlId, evidenceId: input.evidenceId },
      update: {},
    });
  }
  return getSigControlDetail(controlId);
}

export async function unlinkSigControl(
  controlId: string,
  input: {
    requirementId?: string;
    processId?: string;
    documentId?: string;
    evidenceId?: string;
  }
) {
  if (input.requirementId) {
    await prisma.sigControlRequirement.delete({
      where: {
        controlId_requirementId: { controlId, requirementId: input.requirementId },
      },
    });
  }
  if (input.processId) {
    await prisma.sigControlProcess.delete({
      where: { controlId_processId: { controlId, processId: input.processId } },
    });
  }
  if (input.documentId) {
    await prisma.sigControlDocument.delete({
      where: { controlId_documentId: { controlId, documentId: input.documentId } },
    });
  }
  if (input.evidenceId) {
    await prisma.sigControlEvidence.delete({
      where: { controlId_evidenceId: { controlId, evidenceId: input.evidenceId } },
    });
  }
  return getSigControlDetail(controlId);
}
