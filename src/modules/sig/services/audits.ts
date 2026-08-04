import type {
  ActionPlanEfficacyStatus,
  ActionPlanStatus,
  AuditChecklistResult,
  AuditSampleMethod,
  AuditStatus,
  FindingSeverity,
  FindingStatus,
  FindingType,
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
    include: {
      reviewedBy: { select: userSelect },
      sigRequirement: {
        select: {
          id: true,
          code: true,
          title: true,
          standard: { select: { id: true, code: true, name: true } },
        },
      },
      evidenceLinks: {
        include: {
          evidence: {
            select: { id: true, code: true, type: true, description: true, fileName: true },
          },
        },
      },
    },
  },
  samples: {
    orderBy: [{ createdAt: "desc" }],
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  },
  evidenceLinks: {
    include: {
      evidence: {
        select: { id: true, code: true, type: true, description: true, evidenceDate: true },
      },
    },
  },
  findings: {
    orderBy: [{ createdAt: "desc" }],
    include: {
      createdBy: { select: userSelect },
      checklistItem: { select: { id: true, stage: true, result: true } },
      requirementLinks: {
        include: {
          requirement: {
            select: {
              id: true,
              code: true,
              title: true,
              standard: { select: { code: true, name: true } },
            },
          },
        },
      },
      evidenceLinks: {
        include: {
          evidence: {
            select: { id: true, code: true, type: true, description: true, fileName: true },
          },
        },
      },
      actionPlans: {
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        include: {
          createdBy: { select: userSelect },
          responsibleUser: { select: userSelect },
          efficacyVerifiedBy: { select: userSelect },
          evidenceLinks: {
            include: {
              evidence: {
                select: {
                  id: true,
                  code: true,
                  type: true,
                  description: true,
                  fileName: true,
                },
              },
            },
          },
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
  requirementId?: string | null;
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
      requirementId: input.requirementId || null,
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
    requirementId: string | null;
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
  if (input.requirementId !== undefined) {
    data.sigRequirement = input.requirementId
      ? { connect: { id: input.requirementId } }
      : { disconnect: true };
  }
  if (input.notes !== undefined) data.notes = trimText(input.notes);
  if (input.evidence !== undefined) data.evidence = trimText(input.evidence);
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.result !== undefined) {
    data.result = input.result;
    data.reviewedAt = input.result === "PENDING" ? null : new Date();
    data.reviewedBy =
      input.result === "PENDING"
        ? { disconnect: true }
        : input.reviewedById
          ? { connect: { id: input.reviewedById } }
          : undefined;
  }
  return prisma.auditChecklistItem.update({ where: { id }, data });
}

export async function createFindingFromChecklist(input: {
  checklistItemId: string;
  createdById: string;
  title?: string;
  findingType?: FindingType;
  severity?: FindingSeverity;
}) {
  const item = await prisma.auditChecklistItem.findUnique({
    where: { id: input.checklistItemId },
    include: {
      sigRequirement: {
        select: {
          id: true,
          code: true,
          title: true,
          standard: { select: { code: true, name: true } },
        },
      },
    },
  });
  if (!item) throw new Error("Ítem de checklist no encontrado");
  if (item.result !== "NON_COMPLIES") {
    throw new Error("Solo se pueden generar hallazgos desde ítems no conformes");
  }

  const criterion =
    item.sigRequirement
      ? `${item.sigRequirement.standard.code} ${item.sigRequirement.code} — ${item.sigRequirement.title}`
      : item.requirement || item.stage;

  return createFinding({
    auditId: item.auditId,
    title: input.title ?? `NC: ${item.stage}`.slice(0, 200),
    description: item.notes || item.evidence || `No conformidad en: ${item.stage}`,
    findingType: input.findingType ?? "NONCONFORMITY",
    severity: input.severity ?? "MEDIUM",
    criterionText: criterion,
    evidenceStatement: item.evidence || item.notes,
    nonconformityStatement: `No se evidenció el cumplimiento de: ${item.stage}`,
    checklistItemId: item.id,
    requirementIds: item.requirementId ? [item.requirementId] : [],
    createdById: input.createdById,
  });
}

export async function createFinding(input: {
  auditId: string;
  title: string;
  description: string;
  findingType?: FindingType;
  severity?: FindingSeverity;
  status?: FindingStatus;
  criterionText?: string | null;
  evidenceStatement?: string | null;
  nonconformityStatement?: string | null;
  rootCause?: string | null;
  checklistItemId?: string | null;
  requirementIds?: string[];
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    const finding = await tx.finding.create({
      data: {
        auditId: input.auditId,
        title: input.title.trim().slice(0, 200),
        description: input.description.trim().slice(0, 4000),
        findingType: input.findingType ?? "NONCONFORMITY",
        severity: input.severity ?? "MEDIUM",
        status: input.status ?? "OPEN",
        criterionText: trimText(input.criterionText),
        evidenceStatement: trimText(input.evidenceStatement),
        nonconformityStatement: trimText(input.nonconformityStatement),
        rootCause: trimText(input.rootCause),
        checklistItemId: input.checklistItemId || null,
        createdById: input.createdById,
      },
    });

    if (input.requirementIds?.length) {
      await tx.sigFindingRequirement.createMany({
        data: input.requirementIds.map((requirementId) => ({
          findingId: finding.id,
          requirementId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.audit.update({ where: { id: input.auditId }, data: { status: "IN_PROGRESS" } });
    return finding;
  });
}

export async function updateFinding(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    findingType: FindingType;
    severity: FindingSeverity;
    status: FindingStatus;
    criterionText: string | null;
    evidenceStatement: string | null;
    nonconformityStatement: string | null;
    rootCause: string | null;
    checklistItemId: string | null;
    requirementIds: string[];
  }>
) {
  if (input.status === "CLOSED") {
    const finding = await prisma.finding.findUnique({
      where: { id },
      include: {
        actionPlans: {
          include: {
            evidenceLinks: { where: { role: "IMPLEMENTATION" } },
          },
        },
      },
    });
    if (!finding) throw new Error("Hallazgo no encontrado");
    if (finding.findingType === "NONCONFORMITY" || input.findingType === "NONCONFORMITY") {
      const type = input.findingType ?? finding.findingType;
      if (type === "NONCONFORMITY") {
        if (finding.actionPlans.length === 0) {
          throw new Error("Una no conformidad no puede cerrarse sin plan de acción");
        }
        const incomplete = finding.actionPlans.filter(
          (plan) =>
            plan.status !== "COMPLETED" ||
            plan.efficacyStatus !== "VERIFIED" ||
            plan.evidenceLinks.length === 0
        );
        if (incomplete.length > 0) {
          throw new Error(
            "Para cerrar la NC todos los planes deben estar completados, con evidencia de implementación y eficacia verificada"
          );
        }
        const rootCause = input.rootCause !== undefined ? input.rootCause : finding.rootCause;
        if (!rootCause?.trim()) {
          throw new Error("Debe registrar el análisis de causa antes de cerrar la NC");
        }
      }
    }
  }

  const data: Prisma.FindingUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 200);
  if (input.description !== undefined) data.description = input.description.trim().slice(0, 4000);
  if (input.findingType !== undefined) data.findingType = input.findingType;
  if (input.severity !== undefined) data.severity = input.severity;
  if (input.status !== undefined) data.status = input.status;
  if (input.criterionText !== undefined) data.criterionText = trimText(input.criterionText);
  if (input.evidenceStatement !== undefined) data.evidenceStatement = trimText(input.evidenceStatement);
  if (input.nonconformityStatement !== undefined) {
    data.nonconformityStatement = trimText(input.nonconformityStatement);
  }
  if (input.rootCause !== undefined) data.rootCause = trimText(input.rootCause);
  if (input.checklistItemId !== undefined) {
    data.checklistItem = input.checklistItemId
      ? { connect: { id: input.checklistItemId } }
      : { disconnect: true };
  }

  return prisma.$transaction(async (tx) => {
    const finding = await tx.finding.update({ where: { id }, data });
    if (input.requirementIds) {
      await tx.sigFindingRequirement.deleteMany({ where: { findingId: id } });
      if (input.requirementIds.length) {
        await tx.sigFindingRequirement.createMany({
          data: input.requirementIds.map((requirementId) => ({
            findingId: id,
            requirementId,
          })),
        });
      }
    }
    return finding;
  });
}

export async function createActionPlan(input: {
  findingId: string;
  title: string;
  description: string;
  correctionImmediate?: string | null;
  responsibleName?: string | null;
  responsibleUserId?: string | null;
  dueDate?: string | Date | null;
  status?: ActionPlanStatus;
  createdById: string;
}) {
  return prisma.actionPlan.create({
    data: {
      findingId: input.findingId,
      title: input.title.trim().slice(0, 200),
      description: input.description.trim().slice(0, 4000),
      correctionImmediate: trimText(input.correctionImmediate),
      responsibleName: trimText(input.responsibleName, 200),
      responsibleUserId: input.responsibleUserId || null,
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
    correctionImmediate: string | null;
    responsibleName: string | null;
    responsibleUserId: string | null;
    dueDate: string | Date | null;
    status: ActionPlanStatus;
    efficacyStatus: ActionPlanEfficacyStatus;
    efficacyNotes: string | null;
  }>,
  actorId?: string
) {
  if (input.status === "COMPLETED") {
    const plan = await prisma.actionPlan.findUnique({
      where: { id },
      include: {
        evidenceLinks: { where: { role: "IMPLEMENTATION" } },
        finding: { select: { findingType: true } },
      },
    });
    if (!plan) throw new Error("Plan de acción no encontrado");
    if (plan.finding.findingType === "NONCONFORMITY" && plan.evidenceLinks.length === 0) {
      throw new Error("No se puede completar el plan sin evidencia de implementación");
    }
  }

  const data: Prisma.ActionPlanUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 200);
  if (input.description !== undefined) data.description = input.description.trim().slice(0, 4000);
  if (input.correctionImmediate !== undefined) {
    data.correctionImmediate = trimText(input.correctionImmediate);
  }
  if (input.responsibleName !== undefined) data.responsibleName = trimText(input.responsibleName, 200);
  if (input.responsibleUserId !== undefined) {
    data.responsibleUser = input.responsibleUserId
      ? { connect: { id: input.responsibleUserId } }
      : { disconnect: true };
  }
  if (input.dueDate !== undefined) data.dueDate = parseOptionalDate(input.dueDate);
  if (input.status !== undefined) data.status = input.status;
  if (input.efficacyStatus !== undefined) {
    data.efficacyStatus = input.efficacyStatus;
    if (input.efficacyStatus === "VERIFIED" || input.efficacyStatus === "NOT_EFFECTIVE") {
      data.efficacyVerifiedAt = new Date();
      if (actorId) data.efficacyVerifiedBy = { connect: { id: actorId } };
    }
  }
  if (input.efficacyNotes !== undefined) data.efficacyNotes = trimText(input.efficacyNotes);
  return prisma.actionPlan.update({ where: { id }, data });
}

export async function verifyActionPlanEfficacy(input: {
  actionPlanId: string;
  efficacyStatus: "VERIFIED" | "NOT_EFFECTIVE";
  efficacyNotes?: string | null;
  verifiedById: string;
}) {
  const plan = await prisma.actionPlan.findUnique({
    where: { id: input.actionPlanId },
    include: {
      evidenceLinks: { where: { role: { in: ["IMPLEMENTATION", "EFFICACY"] } } },
      finding: { select: { findingType: true } },
    },
  });
  if (!plan) throw new Error("Plan de acción no encontrado");
  if (plan.status !== "COMPLETED" && plan.finding.findingType === "NONCONFORMITY") {
    throw new Error("El plan debe estar completado antes de verificar eficacia");
  }
  if (
    plan.finding.findingType === "NONCONFORMITY" &&
    !plan.evidenceLinks.some((l) => l.role === "IMPLEMENTATION")
  ) {
    throw new Error("Se requiere evidencia de implementación antes de verificar eficacia");
  }

  return prisma.actionPlan.update({
    where: { id: input.actionPlanId },
    data: {
      efficacyStatus: input.efficacyStatus,
      efficacyNotes: trimText(input.efficacyNotes),
      efficacyVerifiedAt: new Date(),
      efficacyVerifiedById: input.verifiedById,
    },
  });
}

export async function createFollowUp(input: {
  actionPlanId: string;
  note: string;
  status: ActionPlanStatus;
  followUpDate?: string | Date | null;
  createdById: string;
}) {
  if (input.status === "COMPLETED") {
    await updateActionPlan(input.actionPlanId, { status: "COMPLETED" });
  }
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
    if (input.status !== "COMPLETED") {
      await tx.actionPlan.update({
        where: { id: input.actionPlanId },
        data: { status: input.status },
      });
    }
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

export async function createAuditSample(input: {
  auditId: string;
  populationDescription: string;
  populationSize?: number | null;
  sampleSize?: number | null;
  method?: AuditSampleMethod;
  notes?: string | null;
  items?: Array<{ code?: string | null; label: string; notes?: string | null }>;
}) {
  return prisma.auditSample.create({
    data: {
      auditId: input.auditId,
      populationDescription: input.populationDescription.trim().slice(0, 4000),
      populationSize: input.populationSize ?? null,
      sampleSize: input.sampleSize ?? input.items?.length ?? null,
      method: input.method ?? "AUDITOR_JUDGMENT",
      notes: trimText(input.notes),
      items: input.items?.length
        ? {
            create: input.items.map((item, index) => ({
              code: trimText(item.code, 100),
              label: item.label.trim().slice(0, 300),
              notes: trimText(item.notes),
              sortOrder: index + 1,
            })),
          }
        : undefined,
    },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });
}

export async function updateAuditSample(
  id: string,
  input: Partial<{
    populationDescription: string;
    populationSize: number | null;
    sampleSize: number | null;
    method: AuditSampleMethod;
    notes: string | null;
    items: Array<{ code?: string | null; label: string; notes?: string | null }>;
  }>
) {
  return prisma.$transaction(async (tx) => {
    const data: Prisma.AuditSampleUpdateInput = {};
    if (input.populationDescription !== undefined) {
      data.populationDescription = input.populationDescription.trim().slice(0, 4000);
    }
    if (input.populationSize !== undefined) data.populationSize = input.populationSize;
    if (input.sampleSize !== undefined) data.sampleSize = input.sampleSize;
    if (input.method !== undefined) data.method = input.method;
    if (input.notes !== undefined) data.notes = trimText(input.notes);

    if (input.items) {
      await tx.auditSampleItem.deleteMany({ where: { sampleId: id } });
      data.items = {
        create: input.items.map((item, index) => ({
          code: trimText(item.code, 100),
          label: item.label.trim().slice(0, 300),
          notes: trimText(item.notes),
          sortOrder: index + 1,
        })),
      };
      if (input.sampleSize === undefined) data.sampleSize = input.items.length;
    }

    return tx.auditSample.update({
      where: { id },
      data,
      include: { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
  });
}
