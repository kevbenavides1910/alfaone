CREATE TABLE IF NOT EXISTS "patrol_route_schedules" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_route_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patrol_route_schedules_routeId_idx"
  ON "patrol_route_schedules"("routeId");
CREATE INDEX IF NOT EXISTS "patrol_route_schedules_routeId_dayOfWeek_idx"
  ON "patrol_route_schedules"("routeId", "dayOfWeek");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patrol_route_schedules_routeId_fkey') THEN
    ALTER TABLE "patrol_route_schedules"
      ADD CONSTRAINT "patrol_route_schedules_routeId_fkey"
      FOREIGN KEY ("routeId") REFERENCES "patrol_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "patrol_routes" ADD COLUMN IF NOT EXISTS "openSchedule" BOOLEAN NOT NULL DEFAULT false;

-- Migrar ventanas de puntos existentes a horario de ruta (todos los días, primera ventana encontrada)
INSERT INTO "patrol_route_schedules" ("id", "routeId", "dayOfWeek", "startTime", "endTime", "sortOrder", "createdAt", "updatedAt")
SELECT
  'mig_sched_' || pr."id" || '_' || d.day,
  pr."id",
  d.day,
  COALESCE(NULLIF(TRIM(p."windowStart"), ''), '00:00'),
  COALESCE(NULLIF(TRIM(p."windowEnd"), ''), '23:59'),
  0,
  NOW(),
  NOW()
FROM "patrol_routes" pr
CROSS JOIN (SELECT generate_series(0, 6) AS day) d
JOIN LATERAL (
  SELECT "windowStart", "windowEnd"
  FROM "patrol_route_points"
  WHERE "routeId" = pr."id"
    AND ("windowStart" IS NOT NULL OR "windowEnd" IS NOT NULL)
  ORDER BY "sortOrder" ASC
  LIMIT 1
) p ON true
WHERE NOT EXISTS (
  SELECT 1 FROM "patrol_route_schedules" s WHERE s."routeId" = pr."id"
);
