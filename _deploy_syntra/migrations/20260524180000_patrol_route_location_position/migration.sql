ALTER TABLE "patrol_routes" ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE "patrol_routes" ADD COLUMN IF NOT EXISTS "positionId" TEXT;

CREATE INDEX IF NOT EXISTS "patrol_routes_locationId_idx" ON "patrol_routes"("locationId");
CREATE INDEX IF NOT EXISTS "patrol_routes_positionId_idx" ON "patrol_routes"("positionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patrol_routes_locationId_fkey') THEN
    ALTER TABLE "patrol_routes"
      ADD CONSTRAINT "patrol_routes_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "contract_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patrol_routes_positionId_fkey') THEN
    ALTER TABLE "patrol_routes"
      ADD CONSTRAINT "patrol_routes_positionId_fkey"
      FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
