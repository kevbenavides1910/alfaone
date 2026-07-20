import type {
  ActionPlanStatus,
  AuditChecklistResult,
  AuditStatus,
  FindingSeverity,
  FindingStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const DEFAULT_CHECKLIST_STAGES = [
  "Vigencia y versión del procedimiento",
  "Objetivo y alcance documentado",
  "Responsables definidos",
  "Entradas, actividades y salidas del proceso",
  "Registros y evidencias requeridas",
  "Controles, riesgos e indicadores",
  "Cumplimiento operativo observado",
] as const;

const procedureWhere: Prisma.SigDocumentWhereInput = {
  documentType: {
    is: {
      OR: [
        { code: { in: ["PROCEDIMIENTO", "PROCEDURE", "PROC"] } },
        { name: { contains: "procedimiento", mode: "insensitive" } },
      ],
      isActive: true,
    },
  },
  status: { not: "OBSOLETE" },
};

export const auditDetailInclude = {
  procedure: {
    include: {
      documentType: { select: { id: true, code: true, name: true } },
      process: { select: { id: true, code: true, name: true } },
      companyEntity: { select: { code: true, name: true } },
      currentVersion: {
        select: {
          id: true,
          versionLabel: true,
          revisionDate: true,
          effectiveFrom: true,
          effectiveUntil: true,
          status: true,
        },
      },
    },
  },
  auditor: { select: userSelect },
  createdBy: { select: userSelect },
  checklistItems: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { reviewedBy: { select: userSelect } },
  },
  findings: {
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdBy: { select: userSelect },
      actionPlans: {
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        include: {
          createdBy: { select: userSelect },
          followUps: {
            orderBy: [{ followUpDate: "desc" }],
            include: { createdBy: { select: userSelect } },
          },
        },
      },
    },
  },
} satisfies Prisma.AuditInclude;

export type AuditDetail = Prisma.AuditGetPayload<{ include: typeof auditDetailInclude }>;

const quarterProcedureInclude = {
  documentType: { select: { id: true, code: true, name: true } },
  process: { select: { id: true, code: true, name: true } },
  companyEntity: { select: { code: true, name: true } },
  currentVersion: {
    select: {
      id: true,
      versionLabel: true,
      revisionDate: true,
      effectiveFrom: true,
      effectiveUntil: true,
      status: true,
    },
  },
} satisfies Prisma.SigDocumentInclude;

export type QuarterProcedure = Prisma.SigDocumentGetPayload<{
  include: typeof quarterProcedureInclude;
}> & {
  audit: Prisma.AuditGetPayload<{
    include: {
      auditor: { select: typeof userSelect };
      checklistItems: { select: { id: true; result: true } };
    };
  }> | null;
};

export function getCurrentAuditQuarter(date = new Date()) {
  return {
    year: date.getFullYear(),
    quarter: Math.floor(date.getMonth() / 3) + 1,
  };
}

function assertQuarter(quarter: number) {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error("Trimestre inválido");
  }
}

function parseOptionalDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha inválida");
  return date;
}

function trimText(value: string | null | undefined, max = 4000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

async function assertProcedureExists(procedureId: string) {
  const procedure = await prisma.sigDocument.findFirst({
    where: { id: procedureId, ...procedureWhere },
    select: { id: true },
  });
  if (!procedure) throw new Error("Procedimiento SIG no encontrado");
}

export async function listAuditQuarterDashboard(input: { year?: number; quarter?: number } = {}) {
  const current = getCurrentAuditQuarter();
  const year = input.year ?? current.year;
  const quarter = input.quarter ?? current.quarter;
  assertQuarter(quarter);

  const [procedures, audits] = await Promise.all([
    prisma.sigDocument.findMany({
      where: procedureWhere,
      orderBy: [{ code: "asc" }, { title: "asc" }],
      include: quarterProcedureInclude,
    }),
    prisma.audit.findMany({
      where: { year, quarter },
      include: {
        auditor: { select: userSelect },
        checklistItems: { select: { id: true, result: true } },
      },
    }),
  ]);

  const auditByProcedure = new Map(audits.map((audit) => [audit.procedureId, audit]));
  const rows: QuarterProcedure[] = procedures.map((procedure) => ({
    ...procedure,
    audit: auditByProcedure.get(procedure.id) ?? null,
  }));

  return {
    year,
    quarter,
    totalProcedures: rows.length,
    assignedAudits: rows.filter((row) => row.audit).length,
    pendingProcedures: rows.filter((row) => !row.audit).length,
    rows,
  };
}

export async function getAuditDetail(id: string): Promise<AuditDetail | null> {
  return prisma.audit.findUnique({
    where: { id },
    include: auditDetailInclude,
  });
}

export async function createAudit(input: {
  procedureId: string;
  scheduledDate: string | Date;
  year?: number;
  quarter?: number;
  status?: AuditStatus;
  scope?: string | null;
  objective?: string | null;
  notes?: string | null;
  auditorId?: string | null;
  createdById: string;
}) {
  const scheduledDate = parseOptionalDate(input.scheduledDate);
  if (!scheduledDate) throw new Error("Fecha de auditoría requerida");
  const derived = getCurrentAuditQuarter(scheduledDate);
  const year = input.year ?? derived.year;
  const quarter = input.quarter ?? derived.quarter;
  assertQuarter(quarter);
  await assertProcedureExists(input.procedureId);

  return prisma.$transaction(async (tx) => {
    const audit = await tx.audit.create({
      data: {
        procedureId: input.procedureId,
        scheduledDate,
        year,
        quarter,
        status: input.status ?? "PLANNED",
        scope: trimText(input.scope),
        objective: trimText(input.objective),
        notes: trimText(input.notes),
        auditorId: input.auditorId || null,
        createdById: input.createdById,
      },
    });

    await tx.auditChecklistItem.createMany({
      data: DEFAULT_CHECKLIST_STAGES.map((stage, index) => ({
        auditId: audit.id,
        stage,
        sortOrder: index + 1,
      })),
    });

    return tx.audit.findUniqueOrThrow({ where: { id: audit.id }, include: auditDetailInclude });
  });
}

export async function updateAudit(
  id: string,
  input: Partial<{
    scheduledDate: string | Date;
    status: AuditStatus;
    scope: string | null;
    objective: string | null;
    notes: string | null;
    auditorId: string | null;
  }>
) {
  const data: Prisma.AuditUpdateInput = {};
  if (input.scheduledDate !== undefined) {
    const scheduledDate = parseOptionalDate(input.scheduledDate);
    if (!scheduledDate) throw new Error("Fecha de auditoría requerida");
    data.scheduledDate = scheduledDate;
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.scope !== undefined) data.scope = trimText(input.scope);
  if (input.objective !== undefined) data.objective = trimText(input.objective);
  if (input.notes !== undefined) data.notes = trimText(input.notes);
  if (input.auditorId !== undefined) {
    data.auditor = input.auditorId ? { connect: { id: input.auditorId } } : { disconnect: true };
  }

  return prisma.audit.update({ where: { id }, data, include: auditDetailInclude });
}

export async function createChecklistItem(input: {
  auditId: string;
  stage: string;
  requirement?: string | null;
  result?: AuditChecklistResult;
  notes?: string | null;
  evidence?: string | null;
  sortOrder?: number;
  reviewedById?: string | null;
}) {
  const result = input.result ?? "PENDING";
  return prisma.auditChecklistItem.create({
    data: {
      auditId: input.auditId,
      stage: input.stage.trim().slice(0, 200),
      requirement: trimText(input.requirement),
      result,
      notes: trimText(input.notes),
      evidence: trimText(input.evidence),
      sortOrder: input.sortOrder ?? 0,
      reviewedAt: result === "PENDING" ? null : new Date(),
      reviewedById: result === "PENDING" ? null : input.reviewedById ?? null,
    },
  });
}

export async function updateChecklistItem(
  id: string,
  input: Partial<{
    stage: string;
    requirement: string | null;
    result: AuditChecklistResult;
    notes: string | null;
    evidence: string | null;
    sortOrder: number;
    reviewedById: string | null;
  }>
) {
  const data: Prisma.AuditChecklistItemUpdateInput = {};
  if (input.stage !== undefined) data.stage = input.stage.trim().slice(0, 200);
  if (input.requirement !== undefined) data.requirement = trimText(input.requirement);
  if (input.notes !== undefined) data.notes = trimText(input.notes);
  if (input.evidence !== undefined) data.evidence = trimText(input.evidence);
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.result !== undefined) {
    data.result = input.result;
    data.reviewedAt = input.result === "PENDING" ? null : new Date();
    data.reviewedBy = input.result === "PENDING"
      ? { disconnect: true }
      : input.reviewedById
        ? { connect: { id: input.reviewedById } }
        : undefined;
  }
  return prisma.auditChecklistItem.update({ where: { id }, data });
}

export async function createFinding(input: {
  auditId: string;
  title: string;
  description: string;
  severity?: FindingSeverity;
  status?: FindingStatus;
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    const finding = await tx.finding.create({
      data: {
        auditId: input.auditId,
        title: input.title.trim().slice(0, 200),
        description: input.description.trim().slice(0, 4000),
        severity: input.severity ?? "MEDIUM",
        status: input.status ?? "OPEN",
        createdById: input.createdById,
      },
    });
    await tx.audit.update({ where: { id: input.auditId }, data: { status: "IN_PROGRESS" } });
    return finding;
  });
}

export async function updateFinding(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    severity: FindingSeverity;
    status: FindingStatus;
  }>
) {
  const data: Prisma.FindingUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 200);
  if (input.description !== undefined) data.description = input.description.trim().slice(0, 4000);
  if (input.severity !== undefined) data.severity = input.severity;
  if (input.status !== undefined) data.status = input.status;
  return prisma.finding.update({ where: { id }, data });
}

export async function createActionPlan(input: {
  findingId: string;
  title: string;
  description: string;
  responsibleName?: string | null;
  dueDate?: string | Date | null;
  status?: ActionPlanStatus;
  createdById: string;
}) {
  return prisma.actionPlan.create({
    data: {
      findingId: input.findingId,
      title: input.title.trim().slice(0, 200),
      description: input.description.trim().slice(0, 4000),
      responsibleName: trimText(input.responsibleName, 200),
      dueDate: parseOptionalDate(input.dueDate),
      status: input.status ?? "PENDING",
      createdById: input.createdById,
    },
  });
}

export async function updateActionPlan(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    responsibleName: string | null;
    dueDate: string | Date | null;
    status: ActionPlanStatus;
  }>
) {
  const data: Prisma.ActionPlanUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 200);
  if (input.description !== undefined) data.description = input.description.trim().slice(0, 4000);
  if (input.responsibleName !== undefined) data.responsibleName = trimText(input.responsibleName, 200);
  if (input.dueDate !== undefined) data.dueDate = parseOptionalDate(input.dueDate);
  if (input.status !== undefined) data.status = input.status;
  return prisma.actionPlan.update({ where: { id }, data });
}

export async function createFollowUp(input: {
  actionPlanId: string;
  note: string;
  status: ActionPlanStatus;
  followUpDate?: string | Date | null;
  createdById: string;
}) {
  const followUpDate = parseOptionalDate(input.followUpDate) ?? new Date();
  return prisma.$transaction(async (tx) => {
    const followUp = await tx.followUp.create({
      data: {
        actionPlanId: input.actionPlanId,
        note: input.note.trim().slice(0, 4000),
        status: input.status,
        followUpDate,
        createdById: input.createdById,
      },
    });
    await tx.actionPlan.update({
      where: { id: input.actionPlanId },
      data: { status: input.status },
    });
    return followUp;
  });
}

export async function updateFollowUp(
  id: string,
  input: Partial<{
    note: string;
    status: ActionPlanStatus;
    followUpDate: string | Date | null;
  }>
) {
  const data: Prisma.FollowUpUpdateInput = {};
  if (input.note !== undefined) data.note = input.note.trim().slice(0, 4000);
  if (input.status !== undefined) data.status = input.status;
  if (input.followUpDate !== undefined) {
    const followUpDate = parseOptionalDate(input.followUpDate);
    if (!followUpDate) throw new Error("Fecha de seguimiento requerida");
    data.followUpDate = followUpDate;
  }
  return prisma.followUp.update({ where: { id }, data });
}
