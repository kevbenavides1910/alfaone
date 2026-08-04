import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { Prisma, SigEvidenceLinkRole, SigEvidenceStatus, SigEvidenceType } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { sigEvidenceRoot } from "@/lib/storage/paths";
import {
  ALLOWED_SIG_EVIDENCE_MIMES,
  MAX_SIG_EVIDENCE_BYTES,
  SIG_EVIDENCE_ROOT,
  sigEvidenceDir,
  storagePathForSigEvidence,
} from "./evidence-uploads";

const evidenceInclude = {
  process: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
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
  auditLinks: { select: { id: true, auditId: true } },
  checklistLinks: { select: { id: true, checklistItemId: true } },
  findingLinks: { select: { id: true, findingId: true } },
  actionPlanLinks: { select: { id: true, actionPlanId: true, role: true } },
} satisfies Prisma.SigEvidenceInclude;

function trimText(value: string | null | undefined, max = 4000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha inválida");
  return date;
}

async function nextEvidenceCode(date = new Date()) {
  const year = date.getFullYear();
  const prefix = `EV-${year}-`;
  const latest = await prisma.sigEvidence.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export async function listSigEvidences(input: {
  q?: string;
  processId?: string;
  requirementId?: string;
  status?: SigEvidenceStatus;
  take?: number;
} = {}) {
  const where: Prisma.SigEvidenceWhereInput = {};
  if (input.processId) where.processId = input.processId;
  if (input.status) where.status = input.status;
  if (input.requirementId) {
    where.requirementLinks = { some: { requirementId: input.requirementId } };
  }
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { fileName: { contains: q, mode: "insensitive" } },
    ];
  }

  return prisma.sigEvidence.findMany({
    where,
    orderBy: [{ evidenceDate: "desc" }, { createdAt: "desc" }],
    take: input.take ?? 100,
    include: evidenceInclude,
  });
}

export async function getSigEvidenceDetail(id: string) {
  return prisma.sigEvidence.findUnique({
    where: { id },
    include: evidenceInclude,
  });
}

export async function createSigEvidence(input: {
  type?: SigEvidenceType;
  description: string;
  evidenceDate: string | Date;
  validUntil?: string | Date | null;
  status?: SigEvidenceStatus;
  processId?: string | null;
  createdById: string;
  requirementIds?: string[];
  auditId?: string | null;
  checklistItemId?: string | null;
  findingId?: string | null;
  actionPlanId?: string | null;
  actionPlanRole?: SigEvidenceLinkRole;
  file?: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  } | null;
}) {
  const evidenceDate = parseDate(input.evidenceDate);
  if (!evidenceDate) throw new Error("Fecha de evidencia requerida");
  if (input.file) {
    if (!ALLOWED_SIG_EVIDENCE_MIMES.has(input.file.mimeType)) {
      throw new Error("Tipo de archivo no permitido");
    }
    if (input.file.buffer.length > MAX_SIG_EVIDENCE_BYTES) {
      throw new Error("Archivo demasiado grande");
    }
  }

  const code = await nextEvidenceCode(evidenceDate);
  const evidence = await prisma.sigEvidence.create({
    data: {
      code,
      type: input.type ?? "OTHER",
      description: input.description.trim().slice(0, 4000),
      evidenceDate,
      validUntil: parseDate(input.validUntil),
      status: input.status ?? "ACTIVE",
      processId: input.processId || null,
      createdById: input.createdById,
      fileName: input.file?.fileName ?? null,
      mimeType: input.file?.mimeType ?? null,
      fileSizeBytes: input.file?.buffer.length ?? null,
    },
  });

  if (input.file) {
    await mkdir(sigEvidenceDir(evidence.id), { recursive: true });
    const safeName = `${Date.now()}_${input.file.fileName.replace(/[^\w.\-]+/g, "_")}`;
    const storagePath = storagePathForSigEvidence(evidence.id, safeName);
    await writeFile(path.join(SIG_EVIDENCE_ROOT, storagePath), input.file.buffer);
    await prisma.sigEvidence.update({
      where: { id: evidence.id },
      data: { storagePath },
    });
  }

  const links: Prisma.PrismaPromise<unknown>[] = [];
  for (const requirementId of input.requirementIds ?? []) {
    links.push(
      prisma.sigEvidenceRequirement.create({
        data: { evidenceId: evidence.id, requirementId },
      })
    );
  }
  if (input.auditId) {
    links.push(
      prisma.sigEvidenceAudit.create({
        data: { evidenceId: evidence.id, auditId: input.auditId },
      })
    );
  }
  if (input.checklistItemId) {
    links.push(
      prisma.sigEvidenceChecklistItem.create({
        data: { evidenceId: evidence.id, checklistItemId: input.checklistItemId },
      })
    );
  }
  if (input.findingId) {
    links.push(
      prisma.sigEvidenceFinding.create({
        data: { evidenceId: evidence.id, findingId: input.findingId },
      })
    );
  }
  if (input.actionPlanId) {
    links.push(
      prisma.sigEvidenceActionPlan.create({
        data: {
          evidenceId: evidence.id,
          actionPlanId: input.actionPlanId,
          role: input.actionPlanRole ?? "IMPLEMENTATION",
        },
      })
    );
  }
  if (links.length) await prisma.$transaction(links);

  return getSigEvidenceDetail(evidence.id);
}

export async function updateSigEvidence(
  id: string,
  input: Partial<{
    type: SigEvidenceType;
    description: string;
    evidenceDate: string | Date;
    validUntil: string | Date | null;
    status: SigEvidenceStatus;
    processId: string | null;
  }>
) {
  const data: Prisma.SigEvidenceUpdateInput = {};
  if (input.type !== undefined) data.type = input.type;
  if (input.description !== undefined) data.description = input.description.trim().slice(0, 4000);
  if (input.evidenceDate !== undefined) {
    const evidenceDate = parseDate(input.evidenceDate);
    if (!evidenceDate) throw new Error("Fecha de evidencia requerida");
    data.evidenceDate = evidenceDate;
  }
  if (input.validUntil !== undefined) data.validUntil = parseDate(input.validUntil);
  if (input.status !== undefined) data.status = input.status;
  if (input.processId !== undefined) {
    data.process = input.processId ? { connect: { id: input.processId } } : { disconnect: true };
  }
  await prisma.sigEvidence.update({ where: { id }, data });
  return getSigEvidenceDetail(id);
}

export async function linkSigEvidence(
  evidenceId: string,
  input: {
    requirementId?: string;
    auditId?: string;
    checklistItemId?: string;
    findingId?: string;
    actionPlanId?: string;
    actionPlanRole?: SigEvidenceLinkRole;
  }
) {
  if (input.requirementId) {
    await prisma.sigEvidenceRequirement.upsert({
      where: {
        evidenceId_requirementId: { evidenceId, requirementId: input.requirementId },
      },
      create: { evidenceId, requirementId: input.requirementId },
      update: {},
    });
  }
  if (input.auditId) {
    await prisma.sigEvidenceAudit.upsert({
      where: { evidenceId_auditId: { evidenceId, auditId: input.auditId } },
      create: { evidenceId, auditId: input.auditId },
      update: {},
    });
  }
  if (input.checklistItemId) {
    await prisma.sigEvidenceChecklistItem.upsert({
      where: {
        evidenceId_checklistItemId: {
          evidenceId,
          checklistItemId: input.checklistItemId,
        },
      },
      create: { evidenceId, checklistItemId: input.checklistItemId },
      update: {},
    });
  }
  if (input.findingId) {
    await prisma.sigEvidenceFinding.upsert({
      where: { evidenceId_findingId: { evidenceId, findingId: input.findingId } },
      create: { evidenceId, findingId: input.findingId },
      update: {},
    });
  }
  if (input.actionPlanId) {
    const role = input.actionPlanRole ?? "IMPLEMENTATION";
    await prisma.sigEvidenceActionPlan.upsert({
      where: {
        evidenceId_actionPlanId_role: {
          evidenceId,
          actionPlanId: input.actionPlanId,
          role,
        },
      },
      create: { evidenceId, actionPlanId: input.actionPlanId, role },
      update: {},
    });
  }
  return getSigEvidenceDetail(evidenceId);
}

export { SIG_EVIDENCE_ROOT, sigEvidenceRoot };
