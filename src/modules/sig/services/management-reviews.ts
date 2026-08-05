import type {
  Prisma,
  SigManagementReviewActionStatus,
  SigManagementReviewInputKey,
  SigManagementReviewStatus,
} from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const userSelect = { id: true, name: true, email: true } as const;

export const MANAGEMENT_REVIEW_INPUT_KEYS: Array<{
  key: SigManagementReviewInputKey;
  label: string;
  sortOrder: number;
}> = [
  { key: "PRIOR_ACTIONS", label: "Seguimiento de acciones de revisiones previas", sortOrder: 1 },
  { key: "CONTEXT_CHANGES", label: "Cambios en el contexto interno/externo", sortOrder: 2 },
  { key: "CUSTOMER_FEEDBACK", label: "Satisfacción del cliente y quejas", sortOrder: 3 },
  { key: "QUALITY_OBJECTIVES", label: "Grado de cumplimiento de objetivos de calidad", sortOrder: 4 },
  { key: "PROCESS_PERFORMANCE", label: "Desempeño de procesos e indicadores", sortOrder: 5 },
  { key: "NONCONFORMITIES_CAPA", label: "No conformidades y acciones correctivas", sortOrder: 6 },
  { key: "MONITORING_MEASUREMENT", label: "Resultados de seguimiento y medición", sortOrder: 7 },
  { key: "AUDIT_RESULTS", label: "Resultados de auditorías", sortOrder: 8 },
  { key: "EXTERNAL_PROVIDERS", label: "Desempeño de proveedores externos", sortOrder: 9 },
  { key: "RESOURCES", label: "Adecuación de recursos", sortOrder: 10 },
  { key: "RISKS_OPPORTUNITIES_EFFICACY", label: "Eficacia de acciones ante riesgos/oportunidades", sortOrder: 11 },
  { key: "IMPROVEMENT_OPPORTUNITIES", label: "Oportunidades de mejora", sortOrder: 12 },
];

const reviewListInclude = {
  chairUser: { select: userSelect },
  createdBy: { select: userSelect },
  previousReview: { select: { id: true, code: true, title: true, meetingDate: true } },
  _count: {
    select: {
      inputs: true,
      actions: true,
      evidenceLinks: true,
      processLinks: true,
    },
  },
  actions: {
    select: { id: true, status: true, dueDate: true },
  },
  inputs: {
    select: { id: true, covered: true },
  },
} satisfies Prisma.SigManagementReviewInclude;

const reviewDetailInclude = {
  chairUser: { select: userSelect },
  createdBy: { select: userSelect },
  previousReview: { select: { id: true, code: true, title: true, meetingDate: true } },
  inputs: { orderBy: { sortOrder: "asc" } },
  actions: {
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    include: { ownerUser: { select: userSelect } },
  },
  processLinks: {
    include: { process: { select: { id: true, code: true, name: true } } },
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
} satisfies Prisma.SigManagementReviewInclude;

export type SigManagementReviewTrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

function trimText(value: string | null | undefined, max = 8000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function parseRequiredDate(value: string | Date, label: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} inválida`);
  return date;
}

function parseOptionalDate(value: string | Date | null | undefined) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function nextReviewCode(date = new Date()) {
  const year = date.getFullYear();
  const prefix = `RPD-${year}-`;
  const latest = await prisma.sigManagementReview.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function actionOpen(status: SigManagementReviewActionStatus) {
  return status === "PENDING" || status === "IN_PROGRESS";
}

function computeTrafficLight(input: {
  status: SigManagementReviewStatus;
  actions: Array<{ status: SigManagementReviewActionStatus; dueDate: Date | null }>;
  inputs: Array<{ covered: boolean }>;
}): SigManagementReviewTrafficLight {
  if (input.status === "CLOSED") return "GREEN";
  const now = Date.now();
  const overdue = input.actions.some(
    (a) => actionOpen(a.status) && a.dueDate && a.dueDate.getTime() < now
  );
  if (overdue) return "RED";
  if (input.status === "FOLLOW_UP" || input.actions.some((a) => actionOpen(a.status))) {
    return "YELLOW";
  }
  if (input.status === "COMPLETED") return "GREEN";
  if (input.status === "IN_PROGRESS") {
    const covered = input.inputs.filter((i) => i.covered).length;
    return covered >= 8 ? "YELLOW" : "GRAY";
  }
  return "GRAY";
}

function enrichReview<
  T extends {
    status: SigManagementReviewStatus;
    actions: Array<{ status: SigManagementReviewActionStatus; dueDate: Date | null }>;
    inputs: Array<{ covered: boolean }>;
  },
>(row: T) {
  const openActions = row.actions.filter((a) => actionOpen(a.status)).length;
  const overdueActions = row.actions.filter(
    (a) => actionOpen(a.status) && a.dueDate && a.dueDate.getTime() < Date.now()
  ).length;
  const coveredInputs = row.inputs.filter((i) => i.covered).length;
  return {
    ...row,
    trafficLight: computeTrafficLight(row),
    openActions,
    overdueActions,
    coveredInputs,
    totalInputs: row.inputs.length,
  };
}

export async function listSigManagementReviews(input: {
  q?: string;
  status?: SigManagementReviewStatus;
  year?: number;
} = {}) {
  const where: Prisma.SigManagementReviewWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.year) {
    const start = new Date(input.year, 0, 1);
    const end = new Date(input.year + 1, 0, 1);
    where.meetingDate = { gte: start, lt: end };
  }
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      { minutesSummary: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.sigManagementReview.findMany({
    where,
    orderBy: [{ meetingDate: "desc" }, { code: "desc" }],
    include: reviewListInclude,
  });

  return rows.map((row) => enrichReview(row));
}

export async function getSigManagementReviewDetail(id: string) {
  const row = await prisma.sigManagementReview.findUnique({
    where: { id },
    include: reviewDetailInclude,
  });
  return row ? enrichReview(row) : null;
}

export async function createSigManagementReview(input: {
  title: string;
  meetingDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  location?: string | null;
  attendees?: string | null;
  agenda?: string | null;
  minutesSummary?: string | null;
  outputImprovements?: string | null;
  outputQmsChanges?: string | null;
  outputResourceNeeds?: string | null;
  status?: SigManagementReviewStatus;
  chairUserId?: string | null;
  previousReviewId?: string | null;
  processIds?: string[];
  evidenceIds?: string[];
  createdById: string;
}) {
  const meetingDate = parseRequiredDate(input.meetingDate, "Fecha de reunión");
  const code = await nextReviewCode(meetingDate);
  const status = input.status ?? "DRAFT";

  const review = await prisma.sigManagementReview.create({
    data: {
      code,
      title: input.title.trim().slice(0, 300),
      status,
      meetingDate,
      periodStart: parseOptionalDate(input.periodStart),
      periodEnd: parseOptionalDate(input.periodEnd),
      location: trimText(input.location, 300),
      attendees: trimText(input.attendees),
      agenda: trimText(input.agenda),
      minutesSummary: trimText(input.minutesSummary),
      outputImprovements: trimText(input.outputImprovements),
      outputQmsChanges: trimText(input.outputQmsChanges),
      outputResourceNeeds: trimText(input.outputResourceNeeds),
      chairUserId: input.chairUserId || null,
      previousReviewId: input.previousReviewId || null,
      closedAt: status === "CLOSED" ? new Date() : null,
      createdById: input.createdById,
      inputs: {
        create: MANAGEMENT_REVIEW_INPUT_KEYS.map((item) => ({
          inputKey: item.key,
          sortOrder: item.sortOrder,
          covered: false,
        })),
      },
    },
  });

  const links: Prisma.PrismaPromise<unknown>[] = [];
  for (const processId of input.processIds ?? []) {
    links.push(
      prisma.sigManagementReviewProcess.create({ data: { reviewId: review.id, processId } })
    );
  }
  for (const evidenceId of input.evidenceIds ?? []) {
    links.push(
      prisma.sigManagementReviewEvidence.create({ data: { reviewId: review.id, evidenceId } })
    );
  }
  if (links.length) await prisma.$transaction(links);

  return getSigManagementReviewDetail(review.id);
}

function assertCanAdvanceStatus(
  status: SigManagementReviewStatus,
  row: {
    minutesSummary: string | null;
    outputImprovements: string | null;
    outputQmsChanges: string | null;
    outputResourceNeeds: string | null;
    actions: Array<{ status: SigManagementReviewActionStatus }>;
    inputs: Array<{ covered: boolean }>;
  }
) {
  if (status === "COMPLETED" || status === "FOLLOW_UP" || status === "CLOSED") {
    if (!trimText(row.minutesSummary)) {
      throw new Error("El acta (resumen de la reunión) es requerida para completar la revisión");
    }
    const hasOutput =
      trimText(row.outputImprovements) ||
      trimText(row.outputQmsChanges) ||
      trimText(row.outputResourceNeeds);
    if (!hasOutput) {
      throw new Error("Registre al menos una salida (mejoras, cambios al SGC o recursos)");
    }
    const covered = row.inputs.filter((i) => i.covered).length;
    if (covered < 8) {
      throw new Error("Marque al menos 8 entradas ISO 9.3.2 como revisadas antes de completar");
    }
  }
  if (status === "CLOSED") {
    const open = row.actions.some((a) => actionOpen(a.status));
    if (open) {
      throw new Error("Cierre todas las acciones de seguimiento (F-SIG-19) antes de cerrar la revisión");
    }
  }
}

export async function updateSigManagementReview(
  id: string,
  input: Partial<{
    title: string;
    meetingDate: string;
    periodStart: string | null;
    periodEnd: string | null;
    location: string | null;
    attendees: string | null;
    agenda: string | null;
    minutesSummary: string | null;
    outputImprovements: string | null;
    outputQmsChanges: string | null;
    outputResourceNeeds: string | null;
    status: SigManagementReviewStatus;
    chairUserId: string | null;
    previousReviewId: string | null;
  }>
) {
  const existing = await prisma.sigManagementReview.findUnique({
    where: { id },
    include: {
      actions: { select: { status: true } },
      inputs: { select: { covered: true } },
    },
  });
  if (!existing) throw new Error("Revisión no encontrada");

  const nextStatus = input.status ?? existing.status;
  const probe = {
    minutesSummary:
      input.minutesSummary !== undefined ? input.minutesSummary : existing.minutesSummary,
    outputImprovements:
      input.outputImprovements !== undefined
        ? input.outputImprovements
        : existing.outputImprovements,
    outputQmsChanges:
      input.outputQmsChanges !== undefined ? input.outputQmsChanges : existing.outputQmsChanges,
    outputResourceNeeds:
      input.outputResourceNeeds !== undefined
        ? input.outputResourceNeeds
        : existing.outputResourceNeeds,
    actions: existing.actions,
    inputs: existing.inputs,
  };
  if (input.status !== undefined) assertCanAdvanceStatus(nextStatus, probe);

  const data: Prisma.SigManagementReviewUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.meetingDate !== undefined) {
    data.meetingDate = parseRequiredDate(input.meetingDate, "Fecha de reunión");
  }
  if (input.periodStart !== undefined) data.periodStart = parseOptionalDate(input.periodStart);
  if (input.periodEnd !== undefined) data.periodEnd = parseOptionalDate(input.periodEnd);
  if (input.location !== undefined) data.location = trimText(input.location, 300);
  if (input.attendees !== undefined) data.attendees = trimText(input.attendees);
  if (input.agenda !== undefined) data.agenda = trimText(input.agenda);
  if (input.minutesSummary !== undefined) data.minutesSummary = trimText(input.minutesSummary);
  if (input.outputImprovements !== undefined) {
    data.outputImprovements = trimText(input.outputImprovements);
  }
  if (input.outputQmsChanges !== undefined) data.outputQmsChanges = trimText(input.outputQmsChanges);
  if (input.outputResourceNeeds !== undefined) {
    data.outputResourceNeeds = trimText(input.outputResourceNeeds);
  }
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "CLOSED" && !existing.closedAt) data.closedAt = new Date();
    if (input.status !== "CLOSED") data.closedAt = null;
  }
  if (input.chairUserId !== undefined) {
    data.chairUser = input.chairUserId
      ? { connect: { id: input.chairUserId } }
      : { disconnect: true };
  }
  if (input.previousReviewId !== undefined) {
    data.previousReview = input.previousReviewId
      ? { connect: { id: input.previousReviewId } }
      : { disconnect: true };
  }

  await prisma.sigManagementReview.update({ where: { id }, data });
  return getSigManagementReviewDetail(id);
}

export async function updateSigManagementReviewInput(
  reviewId: string,
  input: { inputKey: SigManagementReviewInputKey; covered?: boolean; notes?: string | null }
) {
  const row = await prisma.sigManagementReviewInput.findUnique({
    where: { reviewId_inputKey: { reviewId, inputKey: input.inputKey } },
  });
  if (!row) throw new Error("Entrada de revisión no encontrada");

  await prisma.sigManagementReviewInput.update({
    where: { id: row.id },
    data: {
      ...(input.covered !== undefined ? { covered: input.covered } : {}),
      ...(input.notes !== undefined ? { notes: trimText(input.notes) } : {}),
    },
  });
  return getSigManagementReviewDetail(reviewId);
}

export async function createSigManagementReviewAction(
  reviewId: string,
  input: {
    title: string;
    description?: string | null;
    status?: SigManagementReviewActionStatus;
    dueDate?: string | null;
    ownerUserId?: string | null;
    efficacyNotes?: string | null;
  }
) {
  const review = await prisma.sigManagementReview.findUnique({ where: { id: reviewId } });
  if (!review) throw new Error("Revisión no encontrada");
  if (review.status === "CLOSED") {
    throw new Error("No se pueden agregar acciones a una revisión cerrada");
  }

  const status = input.status ?? "PENDING";
  await prisma.sigManagementReviewAction.create({
    data: {
      reviewId,
      title: input.title.trim().slice(0, 300),
      description: trimText(input.description),
      status,
      dueDate: parseOptionalDate(input.dueDate),
      ownerUserId: input.ownerUserId || null,
      efficacyNotes: trimText(input.efficacyNotes),
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  if (review.status === "COMPLETED") {
    await prisma.sigManagementReview.update({
      where: { id: reviewId },
      data: { status: "FOLLOW_UP" },
    });
  }

  return getSigManagementReviewDetail(reviewId);
}

export async function updateSigManagementReviewAction(
  reviewId: string,
  actionId: string,
  input: Partial<{
    title: string;
    description: string | null;
    status: SigManagementReviewActionStatus;
    dueDate: string | null;
    ownerUserId: string | null;
    efficacyNotes: string | null;
  }>
) {
  const action = await prisma.sigManagementReviewAction.findFirst({
    where: { id: actionId, reviewId },
  });
  if (!action) throw new Error("Acción no encontrada");

  const nextStatus = input.status ?? action.status;
  await prisma.sigManagementReviewAction.update({
    where: { id: actionId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim().slice(0, 300) } : {}),
      ...(input.description !== undefined ? { description: trimText(input.description) } : {}),
      ...(input.status !== undefined
        ? {
            status: input.status,
            completedAt:
              input.status === "COMPLETED"
                ? action.completedAt ?? new Date()
                : input.status === "CANCELLED"
                  ? action.completedAt
                  : null,
          }
        : {}),
      ...(input.dueDate !== undefined ? { dueDate: parseOptionalDate(input.dueDate) } : {}),
      ...(input.ownerUserId !== undefined
        ? { ownerUserId: input.ownerUserId || null }
        : {}),
      ...(input.efficacyNotes !== undefined
        ? { efficacyNotes: trimText(input.efficacyNotes) }
        : {}),
    },
  });

  if (nextStatus === "COMPLETED" || nextStatus === "CANCELLED") {
    const openLeft = await prisma.sigManagementReviewAction.count({
      where: {
        reviewId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        NOT: { id: actionId },
      },
    });
    if (openLeft === 0 && !actionOpen(nextStatus)) {
      const review = await prisma.sigManagementReview.findUnique({ where: { id: reviewId } });
      if (review?.status === "FOLLOW_UP") {
        // keep FOLLOW_UP until explicit close
      }
    }
  }

  return getSigManagementReviewDetail(reviewId);
}

export async function deleteSigManagementReviewAction(reviewId: string, actionId: string) {
  const action = await prisma.sigManagementReviewAction.findFirst({
    where: { id: actionId, reviewId },
  });
  if (!action) throw new Error("Acción no encontrada");
  await prisma.sigManagementReviewAction.delete({ where: { id: actionId } });
  return getSigManagementReviewDetail(reviewId);
}

export async function linkSigManagementReview(
  reviewId: string,
  input: { processId?: string; evidenceId?: string }
) {
  if (input.processId) {
    await prisma.sigManagementReviewProcess.upsert({
      where: { reviewId_processId: { reviewId, processId: input.processId } },
      create: { reviewId, processId: input.processId },
      update: {},
    });
  }
  if (input.evidenceId) {
    await prisma.sigManagementReviewEvidence.upsert({
      where: { reviewId_evidenceId: { reviewId, evidenceId: input.evidenceId } },
      create: { reviewId, evidenceId: input.evidenceId },
      update: {},
    });
  }
  return getSigManagementReviewDetail(reviewId);
}

export async function unlinkSigManagementReview(
  reviewId: string,
  input: { processId?: string; evidenceId?: string }
) {
  if (input.processId) {
    await prisma.sigManagementReviewProcess.delete({
      where: { reviewId_processId: { reviewId, processId: input.processId } },
    });
  }
  if (input.evidenceId) {
    await prisma.sigManagementReviewEvidence.delete({
      where: { reviewId_evidenceId: { reviewId, evidenceId: input.evidenceId } },
    });
  }
  return getSigManagementReviewDetail(reviewId);
}
