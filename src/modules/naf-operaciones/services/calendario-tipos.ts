import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type {
  CalendarioEventTypeOption,
  CalendarioEventTypeRef,
  CalendarioEventTypeRow,
} from "@/modules/naf-operaciones/business/calendario-types";
import type {
  CalendarioTipoCreateInput,
  CalendarioTipoPatchInput,
} from "@/modules/naf-operaciones/validations/calendario.schema";

type Result<T> = { ok: true; row: T } | { ok: false; status: 400 | 404; message: string };

const DUPLICATE = "Ya existe un tipo con ese nombre";

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Tipos para el calendario (selector / filtros); los inactivos se muestran solo en eventos existentes. */
export async function listCalendarioEventTypes(): Promise<CalendarioEventTypeOption[]> {
  return prisma.operationalEventTypeConfig.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, color: true, isActive: true },
  });
}

/** Tipos para Mantenimientos, con cantidad de eventos que los usan. */
export async function listCalendarioEventTypesAdmin(): Promise<CalendarioEventTypeRow[]> {
  const rows = await prisma.operationalEventTypeConfig.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { events: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    eventsCount: r._count.events,
  }));
}

export async function createCalendarioEventType(
  input: CalendarioTipoCreateInput,
): Promise<Result<CalendarioEventTypeRef>> {
  try {
    const row = await prisma.operationalEventTypeConfig.create({
      data: input,
      select: { id: true, name: true, color: true },
    });
    return { ok: true, row };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, status: 400, message: DUPLICATE };
    throw e;
  }
}

export async function updateCalendarioEventType(
  id: string,
  input: CalendarioTipoPatchInput,
): Promise<Result<CalendarioEventTypeRef>> {
  const exists = await prisma.operationalEventTypeConfig.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { ok: false, status: 404, message: "Tipo no encontrado" };
  try {
    const row = await prisma.operationalEventTypeConfig.update({
      where: { id },
      data: input,
      select: { id: true, name: true, color: true },
    });
    return { ok: true, row };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, status: 400, message: DUPLICATE };
    throw e;
  }
}

/** Solo se elimina si ningún evento lo usa; si no, hay que desactivarlo. */
export async function deleteCalendarioEventType(id: string): Promise<Result<{ id: string }>> {
  const row = await prisma.operationalEventTypeConfig.findUnique({
    where: { id },
    include: { _count: { select: { events: true } } },
  });
  if (!row) return { ok: false, status: 404, message: "Tipo no encontrado" };
  if (row._count.events > 0) {
    return {
      ok: false,
      status: 400,
      message: `El tipo tiene ${row._count.events} evento(s); desactívelo en lugar de eliminarlo.`,
    };
  }
  await prisma.operationalEventTypeConfig.delete({ where: { id } });
  return { ok: true, row: { id } };
}
