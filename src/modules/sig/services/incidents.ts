import type {
  Prisma,
  SigIncidentSeverity,
  SigIncidentStatus,
  SigIncidentType,
} from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const incidentListInclude = {
  process: { select: { id: true, code: true, name: true } },
  ownerUser: { select: userSelect },
  createdBy: { select: userSelect },
  _count: {
    select: {
      processLinks: true,
      controlLinks: true,
      evidenceLinks: true,
    },
  },
} satisfies Prisma.SigIncidentInclude;

const incidentDetailInclude = {
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
} satisfies Prisma.SigIncidentInclude;

export type SigIncidentTrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

function trimText(value: string | null | undefined, max = 4000) {
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

async function nextIncidentCode(date = new Date()) {
  const year = date.getFullYear();
  const prefix = `INC-${year}-`;
  const latest = await prisma.sigIncident.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const next = latest ? Number(latest.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function computeTrafficLight(input: {
  status: SigIncidentStatus;
  severity: SigIncidentSeverity;
  humanRightsImpact: boolean;
  occurredAt: Date;
}): SigIncidentTrafficLight {
  if (input.status === "CLOSED" || input.status === "DISMISSED") return "GREEN";
  if (
    input.humanRightsImpact ||
    input.severity === "CRITICAL" ||
    input.severity === "HIGH"
  ) {
    return "RED";
  }
  if (input.status === "REPORTED" || input.status === "ACTIONS_PENDING") return "YELLOW";
  const ageDays = (Date.now() - input.occurredAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > 14 && input.status === "UNDER_INVESTIGATION") return "YELLOW";
  return "GRAY";
}

function enrichIncident<
  T extends {
    status: SigIncidentStatus;
    severity: SigIncidentSeverity;
    humanRightsImpact: boolean;
    occurredAt: Date;
  },
>(row: T) {
  return {
    ...row,
    trafficLight: computeTrafficLight(row),
    open:
      row.status !== "CLOSED" &&
      row.status !== "DISMISSED",
  };
}

export async function listSigIncidents(input: {
  q?: string;
  processId?: string;
  type?: SigIncidentType;
  status?: SigIncidentStatus;
  humanRightsImpact?: boolean;
} = {}) {
  const where: Prisma.SigIncidentWhereInput = {};
  if (input.type) where.type = input.type;
  if (input.status) where.status = input.status;
  if (input.humanRightsImpact != null) where.humanRightsImpact = input.humanRightsImpact;
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
          { location: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const rows = await prisma.sigIncident.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { code: "desc" }],
    include: incidentListInclude,
  });

  return rows.map((row) => enrichIncident(row));
}

export async function getSigIncidentDetail(id: string) {
  const row = await prisma.sigIncident.findUnique({
    where: { id },
    include: incidentDetailInclude,
  });
  return row ? enrichIncident(row) : null;
}

export async function createSigIncident(input: {
  title: string;
  description: string;
  type?: SigIncidentType;
  severity?: SigIncidentSeverity;
  status?: SigIncidentStatus;
  occurredAt: string;
  reportedAt?: string | null;
  location?: string | null;
  processId?: string | null;
  ownerUserId?: string | null;
  involvedParties?: string | null;
  immediateActions?: string | null;
  rootCause?: string | null;
  correctiveActions?: string | null;
  humanRightsImpact?: boolean;
  notificationRequired?: boolean;
  notifiedAt?: string | null;
  closureNotes?: string | null;
  processIds?: string[];
  controlIds?: string[];
  evidenceIds?: string[];
  createdById: string;
}) {
  const occurredAt = parseRequiredDate(input.occurredAt, "Fecha de ocurrencia");
  const status = input.status ?? "REPORTED";
  const type = input.type ?? "SECURITY_EVENT";
  const humanRightsImpact =
    input.humanRightsImpact ?? (type === "HUMAN_RIGHTS" || type === "USE_OF_FORCE");

  const code = await nextIncidentCode();
  const incident = await prisma.sigIncident.create({
    data: {
      code,
      title: input.title.trim().slice(0, 300),
      description: input.description.trim().slice(0, 8000),
      type,
      severity: input.severity ?? "MEDIUM",
      status,
      occurredAt,
      reportedAt: parseOptionalDate(input.reportedAt) ?? new Date(),
      location: trimText(input.location, 300),
      processId: input.processId || null,
      ownerUserId: input.ownerUserId || null,
      involvedParties: trimText(input.involvedParties),
      immediateActions: trimText(input.immediateActions),
      rootCause: trimText(input.rootCause),
      correctiveActions: trimText(input.correctiveActions),
      humanRightsImpact,
      notificationRequired: input.notificationRequired ?? humanRightsImpact,
      notifiedAt: parseOptionalDate(input.notifiedAt),
      closedAt: status === "CLOSED" || status === "DISMISSED" ? new Date() : null,
      closureNotes: trimText(input.closureNotes),
      createdById: input.createdById,
    },
  });

  const links: Prisma.PrismaPromise<unknown>[] = [];
  const processIds = new Set(input.processIds ?? []);
  if (input.processId) processIds.add(input.processId);
  for (const processId of processIds) {
    links.push(prisma.sigIncidentProcess.create({ data: { incidentId: incident.id, processId } }));
  }
  for (const controlId of input.controlIds ?? []) {
    links.push(prisma.sigIncidentControl.create({ data: { incidentId: incident.id, controlId } }));
  }
  for (const evidenceId of input.evidenceIds ?? []) {
    links.push(prisma.sigIncidentEvidence.create({ data: { incidentId: incident.id, evidenceId } }));
  }
  if (links.length) await prisma.$transaction(links);

  return getSigIncidentDetail(incident.id);
}

export async function updateSigIncident(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    type: SigIncidentType;
    severity: SigIncidentSeverity;
    status: SigIncidentStatus;
    occurredAt: string;
    reportedAt: string | null;
    location: string | null;
    processId: string | null;
    ownerUserId: string | null;
    involvedParties: string | null;
    immediateActions: string | null;
    rootCause: string | null;
    correctiveActions: string | null;
    humanRightsImpact: boolean;
    notificationRequired: boolean;
    notifiedAt: string | null;
    closureNotes: string | null;
  }>
) {
  const existing = await prisma.sigIncident.findUnique({ where: { id } });
  if (!existing) throw new Error("Incidente no encontrado");

  const nextStatus = input.status ?? existing.status;
  if (
    (nextStatus === "CLOSED" || nextStatus === "DISMISSED") &&
    existing.humanRightsImpact &&
    !trimText(input.rootCause ?? existing.rootCause)
  ) {
    // Allow close only with root cause for DDHH cases when closing via update that sets CLOSED
    if (input.status === "CLOSED" || input.status === "DISMISSED") {
      const rootCause = input.rootCause !== undefined ? input.rootCause : existing.rootCause;
      if (!trimText(rootCause)) {
        throw new Error("Incidentes con impacto en DDHH requieren causa raíz para cerrar");
      }
    }
  }

  const data: Prisma.SigIncidentUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.description !== undefined) data.description = input.description.trim().slice(0, 8000);
  if (input.type !== undefined) data.type = input.type;
  if (input.severity !== undefined) data.severity = input.severity;
  if (input.status !== undefined) {
    data.status = input.status;
    if (
      (input.status === "CLOSED" || input.status === "DISMISSED") &&
      !existing.closedAt
    ) {
      data.closedAt = new Date();
    }
    if (input.status !== "CLOSED" && input.status !== "DISMISSED") {
      data.closedAt = null;
    }
  }
  if (input.occurredAt !== undefined) {
    data.occurredAt = parseRequiredDate(input.occurredAt, "Fecha de ocurrencia");
  }
  if (input.reportedAt !== undefined) data.reportedAt = parseOptionalDate(input.reportedAt) ?? existing.reportedAt;
  if (input.location !== undefined) data.location = trimText(input.location, 300);
  if (input.processId !== undefined) {
    data.process = input.processId ? { connect: { id: input.processId } } : { disconnect: true };
  }
  if (input.ownerUserId !== undefined) {
    data.ownerUser = input.ownerUserId
      ? { connect: { id: input.ownerUserId } }
      : { disconnect: true };
  }
  if (input.involvedParties !== undefined) data.involvedParties = trimText(input.involvedParties);
  if (input.immediateActions !== undefined) data.immediateActions = trimText(input.immediateActions);
  if (input.rootCause !== undefined) data.rootCause = trimText(input.rootCause);
  if (input.correctiveActions !== undefined) {
    data.correctiveActions = trimText(input.correctiveActions);
  }
  if (input.humanRightsImpact !== undefined) data.humanRightsImpact = input.humanRightsImpact;
  if (input.notificationRequired !== undefined) {
    data.notificationRequired = input.notificationRequired;
  }
  if (input.notifiedAt !== undefined) data.notifiedAt = parseOptionalDate(input.notifiedAt);
  if (input.closureNotes !== undefined) data.closureNotes = trimText(input.closureNotes);

  await prisma.sigIncident.update({ where: { id }, data });
  return getSigIncidentDetail(id);
}

export async function linkSigIncident(
  incidentId: string,
  input: { processId?: string; controlId?: string; evidenceId?: string }
) {
  if (input.processId) {
    await prisma.sigIncidentProcess.upsert({
      where: { incidentId_processId: { incidentId, processId: input.processId } },
      create: { incidentId, processId: input.processId },
      update: {},
    });
  }
  if (input.controlId) {
    await prisma.sigIncidentControl.upsert({
      where: { incidentId_controlId: { incidentId, controlId: input.controlId } },
      create: { incidentId, controlId: input.controlId },
      update: {},
    });
  }
  if (input.evidenceId) {
    await prisma.sigIncidentEvidence.upsert({
      where: { incidentId_evidenceId: { incidentId, evidenceId: input.evidenceId } },
      create: { incidentId, evidenceId: input.evidenceId },
      update: {},
    });
  }
  return getSigIncidentDetail(incidentId);
}

export async function unlinkSigIncident(
  incidentId: string,
  input: { processId?: string; controlId?: string; evidenceId?: string }
) {
  if (input.processId) {
    await prisma.sigIncidentProcess.delete({
      where: { incidentId_processId: { incidentId, processId: input.processId } },
    });
  }
  if (input.controlId) {
    await prisma.sigIncidentControl.delete({
      where: { incidentId_controlId: { incidentId, controlId: input.controlId } },
    });
  }
  if (input.evidenceId) {
    await prisma.sigIncidentEvidence.delete({
      where: { incidentId_evidenceId: { incidentId, evidenceId: input.evidenceId } },
    });
  }
  return getSigIncidentDetail(incidentId);
}
