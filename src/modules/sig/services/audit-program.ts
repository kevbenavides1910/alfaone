import type {
  AuditProgramItemStatus,
  AuditProgramPriority,
  AuditProgramStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { createAudit } from "./audits";

const userSelect = { id: true, name: true, email: true } as const;

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

const programItemInclude = {
  process: { select: { id: true, code: true, name: true } },
  procedure: {
    select: {
      id: true,
      code: true,
      title: true,
      processId: true,
      process: { select: { id: true, code: true, name: true } },
    },
  },
  auditor: { select: userSelect },
  linkedAudit: {
    select: {
      id: true,
      year: true,
      quarter: true,
      status: true,
      scheduledDate: true,
    },
  },
} satisfies Prisma.AuditProgramItemInclude;

const programDetailInclude = {
  createdBy: { select: userSelect },
  approvedBy: { select: userSelect },
  items: {
    orderBy: [{ plannedMonth: "asc" }, { priorityScore: "desc" }, { createdAt: "asc" }],
    include: programItemInclude,
  },
} satisfies Prisma.AuditProgramInclude;

function trimText(value: string | null | undefined, max = 4000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function monthToQuarter(month: number) {
  return Math.floor((month - 1) / 3) + 1;
}

function scoreToPriority(score: number): AuditProgramPriority {
  if (score >= 70) return "CRITICAL";
  if (score >= 45) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export type ProcedurePrioritySuggestion = {
  procedureId: string;
  procedureCode: string;
  procedureTitle: string;
  processId: string | null;
  processCode: string | null;
  processName: string | null;
  priorityScore: number;
  priority: AuditProgramPriority;
  priorityReason: string;
  suggestedMonth: number;
  lastAuditDate: Date | null;
  openNcCount: number;
  overdueActionPlans: number;
  overdueControls: number;
};

/** Prioriza procedimientos según ISO 19011 / Manual 9.2: NC, tiempo sin auditar, acciones vencidas, controles. */
export async function computeProcedurePriorities(year: number): Promise<ProcedurePrioritySuggestion[]> {
  const now = new Date();
  const procedures = await prisma.sigDocument.findMany({
    where: procedureWhere,
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      title: true,
      processId: true,
      process: { select: { id: true, code: true, name: true } },
    },
  });

  if (!procedures.length) return [];

  const procedureIds = procedures.map((p) => p.id);
  const processIds = [...new Set(procedures.map((p) => p.processId).filter(Boolean))] as string[];

  const [audits, openFindings, overduePlans, controls] = await Promise.all([
    prisma.audit.findMany({
      where: { procedureId: { in: procedureIds } },
      select: {
        procedureId: true,
        scheduledDate: true,
        year: true,
        quarter: true,
        status: true,
      },
      orderBy: { scheduledDate: "desc" },
    }),
    prisma.finding.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        findingType: "NONCONFORMITY",
        audit: { procedureId: { in: procedureIds } },
      },
      select: {
        severity: true,
        audit: { select: { procedureId: true } },
      },
    }),
    prisma.actionPlan.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: now },
        finding: { audit: { procedureId: { in: procedureIds } } },
      },
      select: {
        finding: { select: { audit: { select: { procedureId: true } } } },
      },
    }),
    processIds.length
      ? prisma.sigControl.findMany({
          where: {
            status: "ACTIVE",
            evidenceIntervalDays: { not: null },
            OR: [
              { processId: { in: processIds } },
              { processLinks: { some: { processId: { in: processIds } } } },
            ],
          },
          select: {
            id: true,
            processId: true,
            evidenceIntervalDays: true,
            processLinks: { select: { processId: true } },
            evidenceLinks: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { evidence: { select: { evidenceDate: true } } },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const lastAuditByProcedure = new Map<string, Date>();
  for (const audit of audits) {
    if (!lastAuditByProcedure.has(audit.procedureId)) {
      lastAuditByProcedure.set(audit.procedureId, audit.scheduledDate);
    }
  }

  const ncByProcedure = new Map<string, { critical: number; high: number; medium: number; low: number }>();
  for (const finding of openFindings) {
    const pid = finding.audit.procedureId;
    const bucket = ncByProcedure.get(pid) ?? { critical: 0, high: 0, medium: 0, low: 0 };
    if (finding.severity === "CRITICAL") bucket.critical += 1;
    else if (finding.severity === "HIGH") bucket.high += 1;
    else if (finding.severity === "MEDIUM") bucket.medium += 1;
    else bucket.low += 1;
    ncByProcedure.set(pid, bucket);
  }

  const overdueByProcedure = new Map<string, number>();
  for (const plan of overduePlans) {
    const pid = plan.finding.audit.procedureId;
    overdueByProcedure.set(pid, (overdueByProcedure.get(pid) ?? 0) + 1);
  }

  const overdueControlsByProcess = new Map<string, number>();
  for (const control of controls) {
    const interval = control.evidenceIntervalDays;
    if (!interval) continue;
    const latest = control.evidenceLinks[0]?.evidence.evidenceDate ?? null;
    const ageDays = latest ? daysBetween(latest, now) : Infinity;
    const overdue = !latest || ageDays > interval;
    if (!overdue) continue;
    const linked = new Set<string>();
    if (control.processId) linked.add(control.processId);
    for (const link of control.processLinks) linked.add(link.processId);
    for (const pid of linked) {
      overdueControlsByProcess.set(pid, (overdueControlsByProcess.get(pid) ?? 0) + 1);
    }
  }

  const scored: ProcedurePrioritySuggestion[] = procedures.map((proc) => {
    const reasons: string[] = [];
    let score = 0;

    const nc = ncByProcedure.get(proc.id) ?? { critical: 0, high: 0, medium: 0, low: 0 };
    const openNcCount = nc.critical + nc.high + nc.medium + nc.low;
    if (nc.critical) {
      score += Math.min(40, nc.critical * 40);
      reasons.push(`${nc.critical} NC crítica(s) abierta(s)`);
    }
    if (nc.high) {
      score += Math.min(30, nc.high * 25);
      reasons.push(`${nc.high} NC mayor(es) abierta(s)`);
    }
    if (nc.medium) {
      score += Math.min(20, nc.medium * 12);
      reasons.push(`${nc.medium} NC media(s) abierta(s)`);
    }
    if (nc.low) {
      score += Math.min(12, nc.low * 6);
      reasons.push(`${nc.low} NC menor(es) abierta(s)`);
    }

    const overdueActions = overdueByProcedure.get(proc.id) ?? 0;
    if (overdueActions) {
      score += Math.min(25, overdueActions * 10);
      reasons.push(`${overdueActions} plan(es) de acción vencido(s)`);
    }

    const lastAuditDate = lastAuditByProcedure.get(proc.id) ?? null;
    if (!lastAuditDate) {
      score += 35;
      reasons.push("Sin auditoría registrada");
    } else {
      const days = daysBetween(lastAuditDate, now);
      if (days >= 365) {
        score += 30;
        reasons.push(`Última auditoría hace ${Math.floor(days / 30)} meses`);
      } else if (days >= 270) {
        score += 22;
        reasons.push(`Última auditoría hace ~${Math.floor(days / 30)} meses`);
      } else if (days >= 180) {
        score += 14;
        reasons.push(`Última auditoría hace ~${Math.floor(days / 30)} meses`);
      } else if (days >= 90) {
        score += 6;
        reasons.push(`Última auditoría reciente (${Math.floor(days / 30)} meses)`);
      } else {
        reasons.push("Auditado en el último trimestre");
      }
    }

    const overdueControls = proc.processId ? overdueControlsByProcess.get(proc.processId) ?? 0 : 0;
    if (overdueControls) {
      score += Math.min(20, overdueControls * 8);
      reasons.push(`${overdueControls} control(es) con evidencia vencida`);
    }

    score = Math.min(200, score);
    return {
      procedureId: proc.id,
      procedureCode: proc.code,
      procedureTitle: proc.title,
      processId: proc.processId,
      processCode: proc.process?.code ?? null,
      processName: proc.process?.name ?? null,
      priorityScore: score,
      priority: scoreToPriority(score),
      priorityReason: reasons.join("; ") || "Prioridad base por cobertura anual",
      suggestedMonth: 1,
      lastAuditDate,
      openNcCount,
      overdueActionPlans: overdueActions,
      overdueControls,
    };
  });

  scored.sort((a, b) => b.priorityScore - a.priorityScore || a.procedureCode.localeCompare(b.procedureCode));

  // Distribuir meses: alta prioridad primero, balanceando por trimestre.
  const monthLoads = Array.from({ length: 12 }, () => 0);
  for (const item of scored) {
    let bestMonth = 1;
    let bestLoad = Number.POSITIVE_INFINITY;
    // Preferir meses del primer semestre para CRITICAL/HIGH
    const monthOrder =
      item.priority === "CRITICAL" || item.priority === "HIGH"
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : [3, 6, 9, 12, 2, 5, 8, 11, 1, 4, 7, 10];
    for (const month of monthOrder) {
      const load = monthLoads[month - 1]!;
      if (load < bestLoad) {
        bestLoad = load;
        bestMonth = month;
      }
    }
    item.suggestedMonth = bestMonth;
    monthLoads[bestMonth - 1]! += 1 + Math.floor(item.priorityScore / 40);
  }

  void year; // reserved for future year-scoped weighting
  return scored;
}

export async function listAuditPrograms() {
  return prisma.auditProgram.findMany({
    orderBy: [{ year: "desc" }],
    include: {
      createdBy: { select: userSelect },
      approvedBy: { select: userSelect },
      _count: { select: { items: true } },
    },
  });
}

export async function getAuditProgramByYear(year: number) {
  return prisma.auditProgram.findUnique({
    where: { year },
    include: programDetailInclude,
  });
}

export async function getAuditProgramDetail(id: string) {
  return prisma.auditProgram.findUnique({
    where: { id },
    include: programDetailInclude,
  });
}

export async function createAuditProgram(input: {
  year: number;
  title?: string;
  notes?: string | null;
  seedFromProcedures?: boolean;
  createdById: string;
}) {
  const existing = await prisma.auditProgram.findUnique({ where: { year: input.year } });
  if (existing) throw new Error(`Ya existe un programa para el año ${input.year}`);

  const title = (input.title?.trim() || `Programa anual de auditorías internas ${input.year}`).slice(0, 300);
  const suggestions =
    input.seedFromProcedures === false ? [] : await computeProcedurePriorities(input.year);

  return prisma.auditProgram.create({
    data: {
      year: input.year,
      title,
      notes: trimText(input.notes),
      createdById: input.createdById,
      items: suggestions.length
        ? {
            create: suggestions.map((s) => ({
              processId: s.processId,
              procedureId: s.procedureId,
              plannedMonth: s.suggestedMonth,
              plannedQuarter: monthToQuarter(s.suggestedMonth),
              priority: s.priority,
              priorityScore: s.priorityScore,
              priorityReason: s.priorityReason,
              status: "PLANNED" as AuditProgramItemStatus,
              objective: `Auditoría interna del procedimiento ${s.procedureCode}`,
            })),
          }
        : undefined,
    },
    include: programDetailInclude,
  });
}

export async function updateAuditProgram(
  id: string,
  input: Partial<{
    title: string;
    notes: string | null;
    status: AuditProgramStatus;
  }>
) {
  const data: Prisma.AuditProgramUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.notes !== undefined) data.notes = trimText(input.notes);
  if (input.status !== undefined) data.status = input.status;
  return prisma.auditProgram.update({
    where: { id },
    data,
    include: programDetailInclude,
  });
}

export async function approveAuditProgram(id: string, approvedById: string) {
  const program = await prisma.auditProgram.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
  if (!program) throw new Error("Programa no encontrado");
  if (program.status === "CLOSED") throw new Error("El programa está cerrado");
  if (program._count.items === 0) throw new Error("No se puede aprobar un programa sin ítems");

  return prisma.auditProgram.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedById,
    },
    include: programDetailInclude,
  });
}

export async function refreshAuditProgramPriorities(id: string) {
  const program = await prisma.auditProgram.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!program) throw new Error("Programa no encontrado");
  if (program.status === "CLOSED") throw new Error("El programa está cerrado");

  const suggestions = await computeProcedurePriorities(program.year);
  const byProcedure = new Map(suggestions.map((s) => [s.procedureId, s]));

  const updates = program.items
    .filter((item) => item.procedureId && item.status !== "CANCELLED" && item.status !== "COMPLETED")
    .map((item) => {
      const suggestion = item.procedureId ? byProcedure.get(item.procedureId) : undefined;
      if (!suggestion) return null;
      return prisma.auditProgramItem.update({
        where: { id: item.id },
        data: {
          priority: suggestion.priority,
          priorityScore: suggestion.priorityScore,
          priorityReason: suggestion.priorityReason,
          processId: suggestion.processId ?? item.processId,
        },
      });
    })
    .filter((op): op is NonNullable<typeof op> => Boolean(op));

  if (updates.length) await prisma.$transaction(updates);

  return getAuditProgramDetail(id);
}

export async function createAuditProgramItem(
  programId: string,
  input: {
    processId?: string | null;
    procedureId?: string | null;
    plannedMonth: number;
    priority?: AuditProgramPriority;
    priorityScore?: number;
    priorityReason?: string | null;
    scope?: string | null;
    objective?: string | null;
    notes?: string | null;
    auditorId?: string | null;
    status?: AuditProgramItemStatus;
  }
) {
  if (input.plannedMonth < 1 || input.plannedMonth > 12) throw new Error("Mes inválido");
  if (!input.procedureId && !input.processId) {
    throw new Error("Indique proceso o procedimiento");
  }

  const program = await prisma.auditProgram.findUnique({ where: { id: programId } });
  if (!program) throw new Error("Programa no encontrado");
  if (program.status === "CLOSED") throw new Error("El programa está cerrado");

  let priority = input.priority ?? "MEDIUM";
  let priorityScore = input.priorityScore ?? 0;
  let priorityReason = trimText(input.priorityReason);
  let processId = input.processId || null;

  if (input.procedureId) {
    const suggestions = await computeProcedurePriorities(program.year);
    const match = suggestions.find((s) => s.procedureId === input.procedureId);
    if (match) {
      if (input.priority === undefined) priority = match.priority;
      if (input.priorityScore === undefined) priorityScore = match.priorityScore;
      if (!priorityReason) priorityReason = match.priorityReason;
      if (!processId) processId = match.processId;
    }
  }

  return prisma.auditProgramItem.create({
    data: {
      programId,
      processId,
      procedureId: input.procedureId || null,
      plannedMonth: input.plannedMonth,
      plannedQuarter: monthToQuarter(input.plannedMonth),
      priority,
      priorityScore,
      priorityReason,
      scope: trimText(input.scope),
      objective: trimText(input.objective),
      notes: trimText(input.notes),
      auditorId: input.auditorId || null,
      status: input.status ?? "PLANNED",
    },
    include: programItemInclude,
  });
}

export async function updateAuditProgramItem(
  id: string,
  input: Partial<{
    processId: string | null;
    procedureId: string | null;
    plannedMonth: number;
    priority: AuditProgramPriority;
    priorityScore: number;
    priorityReason: string | null;
    scope: string | null;
    objective: string | null;
    notes: string | null;
    auditorId: string | null;
    status: AuditProgramItemStatus;
  }>
) {
  const existing = await prisma.auditProgramItem.findUnique({
    where: { id },
    include: { program: { select: { status: true } } },
  });
  if (!existing) throw new Error("Ítem no encontrado");
  if (existing.program.status === "CLOSED") throw new Error("El programa está cerrado");

  const data: Prisma.AuditProgramItemUpdateInput = {};
  if (input.processId !== undefined) data.process = input.processId ? { connect: { id: input.processId } } : { disconnect: true };
  if (input.procedureId !== undefined) {
    data.procedure = input.procedureId ? { connect: { id: input.procedureId } } : { disconnect: true };
  }
  if (input.plannedMonth !== undefined) {
    if (input.plannedMonth < 1 || input.plannedMonth > 12) throw new Error("Mes inválido");
    data.plannedMonth = input.plannedMonth;
    data.plannedQuarter = monthToQuarter(input.plannedMonth);
  }
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.priorityScore !== undefined) data.priorityScore = input.priorityScore;
  if (input.priorityReason !== undefined) data.priorityReason = trimText(input.priorityReason);
  if (input.scope !== undefined) data.scope = trimText(input.scope);
  if (input.objective !== undefined) data.objective = trimText(input.objective);
  if (input.notes !== undefined) data.notes = trimText(input.notes);
  if (input.auditorId !== undefined) {
    data.auditor = input.auditorId ? { connect: { id: input.auditorId } } : { disconnect: true };
  }
  if (input.status !== undefined) data.status = input.status;

  return prisma.auditProgramItem.update({
    where: { id },
    data,
    include: programItemInclude,
  });
}

export async function deleteAuditProgramItem(id: string) {
  const existing = await prisma.auditProgramItem.findUnique({
    where: { id },
    include: { program: { select: { status: true } } },
  });
  if (!existing) throw new Error("Ítem no encontrado");
  if (existing.program.status === "CLOSED") throw new Error("El programa está cerrado");
  if (existing.linkedAuditId) throw new Error("No se puede eliminar un ítem con auditoría vinculada");
  await prisma.auditProgramItem.delete({ where: { id } });
  return { ok: true };
}

/** Crea (o reutiliza) la auditoría trimestral del procedimiento y la vincula al ítem. */
export async function createAuditFromProgramItem(
  itemId: string,
  input: { scheduledDate?: string; auditorId?: string | null; createdById: string }
) {
  const item = await prisma.auditProgramItem.findUnique({
    where: { id: itemId },
    include: {
      program: true,
      procedure: { select: { id: true } },
      linkedAudit: true,
    },
  });
  if (!item) throw new Error("Ítem no encontrado");
  if (!item.procedureId) throw new Error("El ítem no tiene procedimiento asociado");
  if (item.linkedAuditId) {
    return getAuditProgramDetail(item.programId).then((program) => ({
      item: program?.items.find((i) => i.id === itemId),
      auditId: item.linkedAuditId,
      reused: true,
    }));
  }

  const year = item.program.year;
  const quarter = item.plannedQuarter;
  const scheduledDate =
    input.scheduledDate ||
    new Date(year, item.plannedMonth - 1, Math.min(15, new Date(year, item.plannedMonth, 0).getDate())).toISOString();

  const existingAudit = await prisma.audit.findUnique({
    where: {
      procedureId_year_quarter: {
        procedureId: item.procedureId,
        year,
        quarter,
      },
    },
  });

  let auditId: string;
  if (existingAudit) {
    auditId = existingAudit.id;
  } else {
    const audit = await createAudit({
      procedureId: item.procedureId,
      scheduledDate,
      year,
      quarter,
      scope: item.scope,
      objective: item.objective,
      notes: item.notes,
      auditorId: input.auditorId ?? item.auditorId,
      createdById: input.createdById,
    });
    auditId = audit.id;
  }

  await prisma.auditProgramItem.update({
    where: { id: itemId },
    data: {
      linkedAuditId: auditId,
      status: "SCHEDULED",
      auditorId: input.auditorId ?? item.auditorId,
    },
  });

  if (item.program.status === "APPROVED") {
    await prisma.auditProgram.update({
      where: { id: item.programId },
      data: { status: "IN_PROGRESS" },
    });
  }

  const program = await getAuditProgramDetail(item.programId);
  return {
    item: program?.items.find((i) => i.id === itemId),
    auditId,
    reused: Boolean(existingAudit),
  };
}
