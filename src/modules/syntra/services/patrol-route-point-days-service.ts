import { prisma } from "@/modules/core/db/prisma";
import { dayOfWeekFromIsoDate } from "@/modules/syntra/services/patrol-route-schedule-service";

export type RoutePointDayAssignment = {
  pointId: string;
  dayOfWeek: number;
};

type RouteWithPoints = {
  samePointsEveryDay?: boolean;
  points: Array<{ id: string }>;
  pointDays?: RoutePointDayAssignment[];
};

export function getActivePointsForRouteOnDate<P extends { id: string }>(
  route: RouteWithPoints & { points: P[] },
  isoDate: string,
): P[] {
  if (route.samePointsEveryDay ?? true) {
    return route.points;
  }
  const assignments = route.pointDays ?? [];
  // Sin filas guardadas aún: no bloquear la ruta (comportamiento previo).
  if (assignments.length === 0) {
    return route.points;
  }
  const dow = dayOfWeekFromIsoDate(isoDate);
  const activeIds = new Set(
    assignments.filter((d) => d.dayOfWeek === dow).map((d) => d.pointId),
  );
  return route.points.filter((p): p is P => activeIds.has(p.id));
}

export async function getRoutePointDays(routeId: string) {
  const route = await prisma.patrolRoute.findUnique({
    where: { id: routeId },
    select: {
      id: true,
      samePointsEveryDay: true,
      points: { select: { id: true, code: true, name: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
      pointDays: { select: { pointId: true, dayOfWeek: true } },
    },
  });
  if (!route) return null;
  return route;
}

export async function saveRoutePointDays(
  routeId: string,
  samePointsEveryDay: boolean,
  assignments: RoutePointDayAssignment[],
) {
  const route = await prisma.patrolRoute.findUnique({
    where: { id: routeId },
    select: { id: true, points: { select: { id: true } } },
  });
  if (!route) throw new Error("ROUTE_NOT_FOUND");

  const pointIds = new Set(route.points.map((p) => p.id));
  const cleaned = assignments.filter(
    (a) =>
      pointIds.has(a.pointId) &&
      a.dayOfWeek >= 0 &&
      a.dayOfWeek <= 6,
  );

  await prisma.$transaction([
    prisma.patrolRoute.update({
      where: { id: routeId },
      data: { samePointsEveryDay },
    }),
    prisma.patrolRoutePointDay.deleteMany({ where: { routeId } }),
    ...(samePointsEveryDay || cleaned.length === 0
      ? []
      : cleaned.map((a) =>
          prisma.patrolRoutePointDay.create({
            data: {
              routeId,
              pointId: a.pointId,
              dayOfWeek: a.dayOfWeek,
            },
          }),
        )),
  ]);

  return getRoutePointDays(routeId);
}
