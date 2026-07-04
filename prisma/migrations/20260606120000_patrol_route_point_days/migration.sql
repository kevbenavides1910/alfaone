ALTER TABLE "patrol_routes" ADD COLUMN IF NOT EXISTS "samePointsEveryDay" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "patrol_route_point_days" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "pointId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_route_point_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patrol_route_point_days_pointId_dayOfWeek_key"
  ON "patrol_route_point_days"("pointId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "patrol_route_point_days_routeId_idx"
  ON "patrol_route_point_days"("routeId");
CREATE INDEX IF NOT EXISTS "patrol_route_point_days_routeId_dayOfWeek_idx"
  ON "patrol_route_point_days"("routeId", "dayOfWeek");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patrol_route_point_days_routeId_fkey') THEN
    ALTER TABLE "patrol_route_point_days"
      ADD CONSTRAINT "patrol_route_point_days_routeId_fkey"
      FOREIGN KEY ("routeId") REFERENCES "patrol_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patrol_route_point_days_pointId_fkey') THEN
    ALTER TABLE "patrol_route_point_days"
      ADD CONSTRAINT "patrol_route_point_days_pointId_fkey"
      FOREIGN KEY ("pointId") REFERENCES "patrol_route_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
