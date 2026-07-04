-- Horario base replicable a todos los días de la semana.
ALTER TABLE "patrol_routes" ADD COLUMN "sameScheduleEveryDay" BOOLEAN NOT NULL DEFAULT true;

-- Rutas que ya tenían horarios distintos por día conservan el modo personalizado.
UPDATE patrol_routes r
SET "sameScheduleEveryDay" = false
WHERE EXISTS (
  SELECT 1
  FROM (
    SELECT
      "routeId",
      string_agg("startTime" || '-' || "endTime", ',' ORDER BY "sortOrder", "startTime") AS sig
    FROM patrol_route_schedules
    GROUP BY "routeId", "dayOfWeek"
  ) per_day
  WHERE per_day."routeId" = r.id
  GROUP BY per_day."routeId"
  HAVING COUNT(DISTINCT sig) > 1
);
