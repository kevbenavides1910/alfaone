import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  fromIsoDate,
  toIsoDate,
  type CalendarioEventDetail,
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
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
  }
}

const summarySelect = {
  id: true,
  date: true,
  title: true,
  type: true,
  status: true,
  appliesToAllContracts: true,
  zone: { select: { id: true, name: true } },
  _count: { select: { contracts: true } },
} satisfies Prisma.OperationalCalendarEventSelect;

export async function listCalendarioEvents(q: CalendarioListQuery): Promise<CalendarioEventSummary[]> {
  const and: Prisma.OperationalCalendarEventWhereInput[] = [
    { date: { gte: fromIsoDate(q.from), lte: fromIsoDate(q.to) } },
  ];
  if (q.type) and.push({ type: q.type });
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
  }));
}

export async function getCalendarioEvent(id: string): Promise<CalendarioEventDetail | null> {
  const ev = await prisma.operationalCalendarEvent.findUnique({
    where: { id },
    include: {
      zone: { select: { id: true, name: true } },
      contracts: {
        include: { contract: { select: contractZonesSelect } },
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
    description: ev.description,
    createdByName: ev.createdByName,
    createdAt: ev.createdAt.toISOString(),
    contracts,
  };
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

async function assertZone(zoneId: string | null | undefined) {
  if (!zoneId) return;
  const zone = await prisma.zone.findUnique({ where: { id: zoneId }, select: { id: true } });
  if (!zone) throw new CalendarioError("Zona no encontrada");
}

export async function createCalendarioEvent(
  input: CalendarioCreateInput,
  actor: CalendarioActor,
): Promise<CalendarioEventDetail> {
  await assertZone(input.zoneId);
  const contractIds = await resolveContractIds(input);

  const ev = await prisma.operationalCalendarEvent.create({
    data: {
      date: fromIsoDate(input.date),
      title: input.title,
      type: input.type,
      status: input.status ?? "SCHEDULED",
      description: input.description || null,
      zoneId: input.zoneId || null,
      appliesToAllContracts: Boolean(input.allContracts),
      createdById: actor.id,
      createdByName: actor.name ?? null,
      updatedById: actor.id,
      contracts: { createMany: { data: contractIds.map((contractId) => ({ contractId })) } },
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
    select: { id: true, zoneId: true },
  });
  if (!current) throw new CalendarioError("Evento no encontrado", 404);
  if (input.zoneId !== undefined) await assertZone(input.zoneId);

  const touchesContracts = input.allContracts !== undefined || input.contractIds !== undefined;
  const contractIds = touchesContracts
    ? await resolveContractIds({
        allContracts: input.allContracts,
        zoneId: input.zoneId !== undefined ? input.zoneId : current.zoneId,
        contractIds: input.contractIds,
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.operationalCalendarEvent.update({
      where: { id },
      data: {
        ...(input.date !== undefined ? { date: fromIsoDate(input.date) } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
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
  });
  return (await getCalendarioEvent(id))!;
}

export async function deleteCalendarioEvent(id: string): Promise<void> {
  const deleted = await prisma.operationalCalendarEvent.deleteMany({ where: { id } });
  if (deleted.count === 0) throw new CalendarioError("Evento no encontrado", 404);
}

/** Marca/desmarca contratos como completados; el evento pasa a Realizado cuando todos lo están. */
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
        data: { status: nextStatus, updatedById: actor.id },
      });
    }
  });
  return (await getCalendarioEvent(id))!;
}
