import { prisma } from "@/modules/core/db/prisma";
import {
  addMonthsIso,
  CALENDARIO_RECURRENCE_MONTHS,
  fromIsoDate,
  monthBeforeIso,
  toIsoDate,
  type CalendarioRecurrence,
} from "@/modules/naf-operaciones/business/calendario-types";

/**
 * Mantiene cada serie con al menos 12 meses de fechas por delante.
 * Las fechas nuevas no reenvían el «te asignaron»; esperan el aviso de un mes antes.
 */
export async function extendCalendarioSeries(todayIso: string): Promise<number> {
  const keepUntil = addMonthsIso(todayIso, 12);
  const cap = addMonthsIso(todayIso, 24);
  const groups = await prisma.operationalCalendarEvent.groupBy({
    by: ["seriesId", "recurrence"],
    where: { seriesId: { not: null }, recurrence: { not: "NONE" } },
    _max: { date: true },
  });

  let created = 0;
  for (const group of groups) {
    if (created >= 40) break;
    if (!group.seriesId || !group._max.date || group.recurrence === "NONE") continue;
    const lastIso = toIsoDate(group._max.date);
    if (lastIso >= keepUntil) continue;
    const step = CALENDARIO_RECURRENCE_MONTHS[group.recurrence as Exclude<CalendarioRecurrence, "NONE">];
    const next = addMonthsIso(lastIso, step);
    if (next > cap) continue;

    const exists = await prisma.operationalCalendarEvent.findFirst({
      where: { seriesId: group.seriesId, date: fromIsoDate(next) },
      select: { id: true },
    });
    if (exists) continue;

    const source = await prisma.operationalCalendarEvent.findFirst({
      where: { seriesId: group.seriesId, date: group._max.date },
      include: {
        contracts: { select: { contractId: true } },
        admins: { select: { userId: true } },
      },
    });
    if (!source) continue;

    await prisma.operationalCalendarEvent.create({
      data: {
        date: fromIsoDate(next),
        monthBeforeOn: fromIsoDate(monthBeforeIso(next)),
        title: source.title,
        typeId: source.typeId,
        status: "SCHEDULED",
        description: source.description,
        zoneId: source.zoneId,
        appliesToAllContracts: source.appliesToAllContracts,
        recurrence: source.recurrence,
        seriesId: source.seriesId,
        createdById: source.createdById,
        createdByName: source.createdByName,
        updatedById: source.updatedById,
        contracts: { create: source.contracts.map((c) => ({ contractId: c.contractId })) },
        admins: {
          create: source.admins.map((a) => ({
            userId: a.userId,
            assignedNotifiedAt: new Date(),
          })),
        },
      },
    });
    created += 1;
  }
  return created;
}
