import { prisma } from "@/modules/core/db/prisma";

const CR_TZ = "America/Costa_Rica";

export type RouteScheduleSlot = {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function normalizeTime(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error("INVALID_TIME");
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error("INVALID_TIME");
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function validateScheduleSlots(slots: RouteScheduleSlot[]) {
  for (const slot of slots) {
    if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) throw new Error("INVALID_DAY");
    normalizeTime(slot.startTime);
    normalizeTime(slot.endTime);
  }
}

export async function getRouteSchedules(routeId: string): Promise<RouteScheduleSlot[]> {
  const rows = await prisma.patrolRouteSchedule.findMany({
    where: { routeId },
    orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }, { startTime: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    sortOrder: r.sortOrder,
  }));
}

export async function replaceRouteSchedules(
  routeId: string,
  openSchedule: boolean,
  slots: RouteScheduleSlot[],
) {
  if (!openSchedule) {
    validateScheduleSlots(slots);
  }

  await prisma.$transaction(async (tx) => {
    await tx.patrolRoute.update({
      where: { id: routeId },
      data: { openSchedule },
    });
    await tx.patrolRouteSchedule.deleteMany({ where: { routeId } });

    if (!openSchedule && slots.length > 0) {
      await tx.patrolRouteSchedule.createMany({
        data: slots.map((s, i) => ({
          routeId,
          dayOfWeek: s.dayOfWeek,
          startTime: normalizeTime(s.startTime),
          endTime: normalizeTime(s.endTime),
          sortOrder: s.sortOrder ?? i,
        })),
      });
    }
  });
}

/** Día de la semana en Costa Rica: 0=domingo … 6=sábado. */
export function dayOfWeekInCostaRica(date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: CR_TZ, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

export function dayOfWeekFromIsoDate(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const noon = new Date(Date.UTC(y, m - 1, d, 18, 0, 0));
  return dayOfWeekInCostaRica(noon);
}

export function getScheduleWindowsForDate(
  route: {
    openSchedule: boolean;
    schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
  },
  isoDate: string,
): { startTime: string; endTime: string }[] {
  if (route.openSchedule) {
    return [{ startTime: "00:00", endTime: "23:59" }];
  }

  const dow = dayOfWeekFromIsoDate(isoDate);
  return route.schedules
    .filter((s) => s.dayOfWeek === dow)
    .map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
}

export function getTodayScheduleWindows(route: {
  openSchedule: boolean;
  schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
}): { startTime: string; endTime: string }[] {
  if (route.openSchedule) {
    return [{ startTime: "00:00", endTime: "23:59" }];
  }

  const today = dayOfWeekInCostaRica(new Date());
  return route.schedules
    .filter((s) => s.dayOfWeek === today)
    .map((s) => ({ startTime: s.startTime, endTime: s.endTime }));
}

export const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
