import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/modules/core/db/prisma";
import { hasPermission } from "@/lib/permissions/check";
import {
  fromIsoDate,
  toIsoDate,
  type CalendarioEventDetail,
  type CalendarioEventStatus,
  type CalendarioEventSummary,
} from "@/modules/naf-operaciones/business/calendario-types";
import {
  calendarioContractsWhere,
  contractZonesSelect,
  mapContractOption,
} from "@/modules/naf-operaciones/services/calendario-opciones";
import type {
  CalendarioCompletionInput,
  CalendarioCreateInput,
  CalendarioListQuery,
  CalendarioUpdateInput,
} from "@/modules/naf-operaciones/validations/calendario.schema";

export type CalendarioActor = { id: string; name?: string | null };

export class CalendarioError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message);
  }
}

const adminsSelect = {
  orderBy: { user: { name: "asc" } },
  select: { user: { select: { id: true, name: true } } },
} satisfies Prisma.OperationalCalendarEvent$adminsArgs;

const summarySelect = {
  id: true,
  date: true,
  title: true,
  type: { select: { id: true, name: true, color: true } },
  status: true,
  appliesToAllContracts: true,
  zone: { select: { id: true, name: true } },
  admins: adminsSelect,
  _count: { select: { contracts: true, attachments: true } },
} satisfies Prisma.OperationalCalendarEventSelect;

export async function listCalendarioEvents(q: CalendarioListQuery): Promise<CalendarioEventSummary[]> {
  const and: Prisma.OperationalCalendarEventWhereInput[] = [
    { date: { gte: fromIsoDate(q.from), lte: fromIsoDate(q.to) } },
  ];
  if (q.typeId) and.push({ typeId: q.typeId });
  if (q.status) and.push({ status: q.status });
  if (q.adminUserIds?.length) and.push({ admins: { some: { userId: { in: q.adminUserIds } } } });
  if (q.contractId) and.push({ contracts: { some: { contractId: q.contractId } } });
  if (q.zoneId) {
    and.push({
      OR: [
        { zoneId: q.zoneId },
        { contracts: { some: { contract: { positions: { some: { zoneId: q.zoneId } } } } } },
      ],
    });
  }

  const rows = await prisma.operationalCalendarEvent.findMany({
    where: { AND: and },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: summarySelect,
    take: 2000,
  });
  if (rows.length === 0) return [];

  const completed = await prisma.operationalCalendarEventContract.groupBy({
    by: ["eventId"],
    where: { eventId: { in: rows.map((r) => r.id) }, completedAt: { not: null } },
    _count: { _all: true },
  });
  const completedByEvent = new Map(completed.map((c) => [c.eventId, c._count._all]));

  return rows.map((r) => ({
    id: r.id,
    date: toIsoDate(r.date),
    title: r.title,
    type: r.type,
    status: r.status,
    zone: r.zone,
    appliesToAllContracts: r.appliesToAllContracts,
    contractsCount: r._count.contracts,
    completedCount: completedByEvent.get(r.id) ?? 0,
    admins: r.admins.map((a) => a.user),
    attachmentsCount: r._count.attachments,
  }));
}

export function calendarioAttachmentUrl(eventId: string, attachmentId: string): string {
  return `/api/naf-operaciones/calendario/${eventId}/evidencias/${attachmentId}`;
}

export async function getCalendarioEvent(id: string): Promise<CalendarioEventDetail | null> {
  const ev = await prisma.operationalCalendarEvent.findUnique({
    where: { id },
    include: {
      zone: { select: { id: true, name: true } },
      type: { select: { id: true, name: true, color: true } },
      admins: adminsSelect,
      contracts: {
        include: { contract: { select: contractZonesSelect } },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: { contract: { select: { id: true, licitacionNo: true, client: true } } },
      },
    },
  });
  if (!ev) return null;

  const contracts = ev.contracts
    .map((link) => ({
      ...mapContractOption(link.contract),
      completedAt: link.completedAt ? link.completedAt.toISOString() : null,
    }))
    .sort((a, b) => a.client.localeCompare(b.client, "es"));

  return {
    id: ev.id,
    date: toIsoDate(ev.date),
    title: ev.title,
    type: ev.type,
    status: ev.status,
    zone: ev.zone,
    appliesToAllContracts: ev.appliesToAllContracts,
    contractsCount: contracts.length,
    completedCount: contracts.filter((c) => c.completedAt).length,
    admins: ev.admins.map((a) => a.user),
    attachmentsCount: ev.attachments.length,
    description: ev.description,
    createdByName: ev.createdByName,
    createdAt: ev.createdAt.toISOString(),
    completedAt: ev.completedAt ? ev.completedAt.toISOString() : null,
    completedByName: ev.completedByName,
    contracts,
    attachments: ev.attachments.map((a) => ({
      id: a.id,
      originalName: a.originalName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      contract: a.contract
        ? { id: a.contract.id, label: `${a.contract.client} · ${a.contract.licitacionNo}` }
        : null,
      uploadedByName: a.uploadedByName,
      createdAt: a.createdAt.toISOString(),
      url: calendarioAttachmentUrl(ev.id, a.id),
    })),
  };
}

/**
 * Quien tiene «Editar» en el calendario actúa sobre cualquier evento;
 * un administrador asignado puede marcar avance y subir evidencia en los suyos aunque solo tenga «Ver».
 */
export async function assertCanActOnEvent(session: Session, eventId: string): Promise<void> {
  const exists = await prisma.operationalCalendarEvent.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!exists) throw new CalendarioError("Evento no encontrado", 404);
  if (hasPermission(session, "nafOperaciones.calendario", "edit")) return;
  const assigned = await prisma.operationalCalendarEventAdmin.findUnique({
    where: { eventId_userId: { eventId, userId: session.user.id } },
    select: { id: true },
  });
  if (!assigned) {
    throw new CalendarioError("Solo los administradores asignados o quien puede editar el calendario", 403);
  }
}

async function resolveContractIds(input: {
  allContracts?: boolean;
  zoneId?: string | null;
  contractIds?: string[];
}): Promise<string[]> {
  if (input.allContracts) {
    const rows = await prisma.contract.findMany({
      where: calendarioContractsWhere(input.zoneId),
      select: { id: true },
    });
    if (rows.length === 0) throw new CalendarioError("No hay contratos vigentes para la zona seleccionada");
    return rows.map((r) => r.id);
  }
  const requested = [...new Set(input.contractIds ?? [])];
  if (requested.length === 0) throw new CalendarioError("Seleccione al menos un contrato");
  const found = await prisma.contract.findMany({
    where: { id: { in: requested }, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== requested.length) throw new CalendarioError("Uno o más contratos no existen");
  return found.map((r) => r.id);
}

/** Usuarios activos; uno inactivo solo se conserva si ya estaba asignado al evento. */
async function resolveAdminIds(ids: string[] | undefined, eventId?: string): Promise<string[]> {
  const requested = [...new Set(ids ?? [])];
  if (requested.length === 0) return [];
  const found = await prisma.user.findMany({
    where: {
      id: { in: requested },
      OR: [
        { isActive: true },
        ...(eventId ? [{ operationalEventsAdministered: { some: { eventId } } }] : []),
      ],
    },
    select: { id: true },
  });
  if (found.length !== requested.length) throw new CalendarioError("Uno o más administradores no existen o están inactivos");
  return found.map((u) => u.id);
}

async function assertZone(zoneId: string | null | undefined) {
  if (!zoneId) return;
  const zone = await prisma.zone.findUnique({ where: { id: zoneId }, select: { id: true } });
  if (!zone) throw new CalendarioError("Zona no encontrada");
}

/** Un tipo inactivo solo se acepta si el evento ya lo tenía. */
async function assertType(typeId: string, currentTypeId?: string) {
  const type = await prisma.operationalEventTypeConfig.findUnique({
    where: { id: typeId },
    select: { isActive: true },
  });
  if (!type) throw new CalendarioError("Tipo de evento no encontrado");
  if (!type.isActive && typeId !== currentTypeId) throw new CalendarioError("El tipo de evento está inactivo");
}

function statusData(status: CalendarioEventStatus, actor: CalendarioActor) {
  return status === "DONE"
    ? { status, completedAt: new Date(), completedByName: actor.name ?? null }
    : { status, completedAt: null, completedByName: null };
}

export async function createCalendarioEvent(
  input: CalendarioCreateInput,
  actor: CalendarioActor,
): Promise<CalendarioEventDetail> {
  await assertZone(input.zoneId);
  await assertType(input.typeId);
  const contractIds = await resolveContractIds(input);
  const adminIds = await resolveAdminIds(input.adminUserIds);
  const status = input.status ?? "SCHEDULED";

  const ev = await prisma.operationalCalendarEvent.create({
    data: {
      date: fromIsoDate(input.date),
      title: input.title,
      typeId: input.typeId,
      ...statusData(status, actor),
      description: input.description || null,
      zoneId: input.zoneId || null,
      appliesToAllContracts: Boolean(input.allContracts),
      createdById: actor.id,
      createdByName: actor.name ?? null,
      updatedById: actor.id,
      contracts: {
        createMany: {
          data: contractIds.map((contractId) => ({
            contractId,
            completedAt: status === "DONE" ? new Date() : null,
          })),
        },
      },
      admins: { createMany: { data: adminIds.map((userId) => ({ userId })) } },
    },
    select: { id: true },
  });
  return (await getCalendarioEvent(ev.id))!;
}

export async function updateCalendarioEvent(
  id: string,
  input: CalendarioUpdateInput,
  actor: CalendarioActor,
): Promise<CalendarioEventDetail> {
  const current = await prisma.operationalCalendarEvent.findUnique({
    where: { id },
    select: { id: true, zoneId: true, typeId: true, status: true },
  });
  if (!current) throw new CalendarioError("Evento no encontrado", 404);
  if (input.zoneId !== undefined) await assertZone(input.zoneId);
  if (input.typeId !== undefined) await assertType(input.typeId, current.typeId);

  const touchesContracts = input.allContracts !== undefined || input.contractIds !== undefined;
  const contractIds = touchesContracts
    ? await resolveContractIds({
        allContracts: input.allContracts,
        zoneId: input.zoneId !== undefined ? input.zoneId : current.zoneId,
        contractIds: input.contractIds,
      })
    : null;
  const adminIds = input.adminUserIds !== undefined ? await resolveAdminIds(input.adminUserIds, id) : null;
  const statusChanged = input.status !== undefined && input.status !== current.status;

  await prisma.$transaction(async (tx) => {
    await tx.operationalCalendarEvent.update({
      where: { id },
      data: {
        ...(input.date !== undefined ? { date: fromIsoDate(input.date) } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.typeId !== undefined ? { typeId: input.typeId } : {}),
        ...(statusChanged ? statusData(input.status!, actor) : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.zoneId !== undefined ? { zoneId: input.zoneId || null } : {}),
        ...(touchesContracts ? { appliesToAllContracts: Boolean(input.allContracts) } : {}),
        updatedById: actor.id,
      },
    });
    if (contractIds) {
      await tx.operationalCalendarEventContract.deleteMany({
        where: { eventId: id, contractId: { notIn: contractIds } },
      });
      await tx.operationalCalendarEventContract.createMany({
        data: contractIds.map((contractId) => ({ eventId: id, contractId })),
        skipDuplicates: true,
      });
    }
    if (adminIds) {
      await tx.operationalCalendarEventAdmin.deleteMany({
        where: { eventId: id, userId: { notIn: adminIds } },
      });
      await tx.operationalCalendarEventAdmin.createMany({
        data: adminIds.map((userId) => ({ eventId: id, userId })),
        skipDuplicates: true,
      });
    }
    if (statusChanged && input.status === "DONE") {
      await tx.operationalCalendarEventContract.updateMany({
        where: { eventId: id, completedAt: null },
        data: { completedAt: new Date() },
      });
    }
  });
  return (await getCalendarioEvent(id))!;
}

/** Realizada completa los contratos pendientes; Pendiente solo reabre el evento (conserva el avance por contrato). */
export async function setCalendarioStatus(
  id: string,
  status: "SCHEDULED" | "DONE",
  actor: CalendarioActor,
): Promise<CalendarioEventDetail> {
  const ev = await prisma.operationalCalendarEvent.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!ev) throw new CalendarioError("Evento no encontrado", 404);
  if (ev.status === "CANCELLED") throw new CalendarioError("El evento está cancelado; reactívelo primero");
  if (ev.status === status) return (await getCalendarioEvent(id))!;

  await prisma.$transaction(async (tx) => {
    await tx.operationalCalendarEvent.update({
      where: { id },
      data: { ...statusData(status, actor), updatedById: actor.id },
    });
    if (status === "DONE") {
      await tx.operationalCalendarEventContract.updateMany({
        where: { eventId: id, completedAt: null },
        data: { completedAt: new Date() },
      });
    }
  });
  return (await getCalendarioEvent(id))!;
}

export async function deleteCalendarioEvent(id: string): Promise<void> {
  const deleted = await prisma.operationalCalendarEvent.deleteMany({ where: { id } });
  if (deleted.count === 0) throw new CalendarioError("Evento no encontrado", 404);
}

/** Marca/desmarca contratos como completados; el evento pasa a Realizada cuando todos lo están. */
export async function setCalendarioCompletion(
  id: string,
  input: CalendarioCompletionInput,
  actor: CalendarioActor,
): Promise<CalendarioEventDetail> {
  const ev = await prisma.operationalCalendarEvent.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!ev) throw new CalendarioError("Evento no encontrado", 404);

  await prisma.$transaction(async (tx) => {
    await tx.operationalCalendarEventContract.updateMany({
      where: {
        eventId: id,
        ...(input.contractIds?.length ? { contractId: { in: input.contractIds } } : {}),
      },
      data: { completedAt: input.completed ? new Date() : null },
    });
    const pending = await tx.operationalCalendarEventContract.count({
      where: { eventId: id, completedAt: null },
    });
    const nextStatus =
      ev.status === "CANCELLED" ? ev.status : pending === 0 ? "DONE" : "SCHEDULED";
    if (nextStatus !== ev.status) {
      await tx.operationalCalendarEvent.update({
        where: { id },
        data: { ...statusData(nextStatus, actor), updatedById: actor.id },
      });
    }
  });
  return (await getCalendarioEvent(id))!;
}
