import { prisma } from "@/modules/core/db/prisma";
import { dayOfWeekFromIsoDate } from "@/modules/syntra/services/patrol-route-schedule-service";

export type RoutePointDayAssignment = {
  dayOfWeek: number;
  pointIds: string[];
};

export type RoutePointDayRow = {
  pointId: string;
  dayOfWeek: number;
};

export function validatePointDayAssignments(
  assignments: RoutePointDayAssignment[],
  validPointIds: Set<string>,
) {
  for (const day of assignments) {
    if (day.dayOfWeek < 0 || day.dayOfWeek > 6) throw new Error("INVALID_DAY");
    for (const pointId of day.pointIds) {
      if (!validPointIds.has(pointId)) throw new Error("INVALID_POINT");
    }
  }
}

export async function getRoutePointDays(routeId: string): Promise<RoutePointDayRow[]> {
  const rows = await prisma.patrolRoutePointDay.findMany({
    where: { routeId },
    orderBy: [{ dayOfWeek: "asc" }, { pointId: "asc" }],
    select: { pointId: true, dayOfWeek: true },
  });
  return rows;
}

export async function replaceRoutePointDays(
  routeId: string,
  samePointsEveryDay: boolean,
  assignments: RoutePointDayAssignment[],
) {
  const points = await prisma.patrolRoutePoint.findMany({
    where: { routeId },
    select: { id: true },
  });
  const validPointIds = new Set(points.map((p) => p.id));

  if (!samePointsEveryDay) {
    validatePointDayAssignments(assignments, validPointIds);
  }

  await prisma.$transaction(async (tx) => {
    await tx.patrolRoute.update({
      where: { id: routeId },
      data: { samePointsEveryDay },
    });
    await tx.patrolRoutePointDay.deleteMany({ where: { routeId } });

    if (!samePointsEveryDay) {
      const rows: { routeId: string; pointId: string; dayOfWeek: number }[] = [];
      for (const day of assignments) {
        for (const pointId of day.pointIds) {
          rows.push({ routeId, pointId, dayOfWeek: day.dayOfWeek });
        }
      }
      if (rows.length > 0) {
        await tx.patrolRoutePointDay.createMany({ data: rows });
      }
    }
  });
}

export function groupPointDaysByWeekday(rows: RoutePointDayRow[]): RoutePointDayAssignment[] {
  const byDay = new Map<number, string[]>();
  for (const row of rows) {
    const list = byDay.get(row.dayOfWeek) ?? [];
    list.push(row.pointId);
    byDay.set(row.dayOfWeek, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayOfWeek, pointIds]) => ({ dayOfWeek, pointIds }));
}

type RoutePoint = { id: string };

export function getPointsForDate<T extends RoutePoint>(
  route: {
    samePointsEveryDay: boolean;
    points: T[];
    pointDays?: RoutePointDayRow[];
  },
  isoDate: string,
): T[] {
  if (route.samePointsEveryDay !== false) {
    return route.points;
  }

  const dow = dayOfWeekFromIsoDate(isoDate);
  const pointIdsForDay = new Set(
    (route.pointDays ?? []).filter((pd) => pd.dayOfWeek === dow).map((pd) => pd.pointId),
  );
  return route.points.filter((p) => pointIdsForDay.has(p.id));
}
