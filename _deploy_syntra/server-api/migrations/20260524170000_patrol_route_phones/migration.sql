CREATE TABLE IF NOT EXISTS "patrol_route_phones" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_route_phones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patrol_route_phones_routeId_assetId_key"
  ON "patrol_route_phones"("routeId", "assetId");
CREATE INDEX IF NOT EXISTS "patrol_route_phones_routeId_idx"
  ON "patrol_route_phones"("routeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'patrol_route_phones_routeId_fkey'
  ) THEN
    ALTER TABLE "patrol_route_phones"
      ADD CONSTRAINT "patrol_route_phones_routeId_fkey"
      FOREIGN KEY ("routeId") REFERENCES "patrol_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Migrar asignaciones vigentes a teléfonos autorizados por ruta
INSERT INTO "patrol_route_phones" ("id", "routeId", "assetId", "isPrimary", "createdAt", "updatedAt")
SELECT
  'mig_' || pa."id",
  pa."routeId",
  pd."assetId",
  true,
  NOW(),
  NOW()
FROM "patrol_assignments" pa
JOIN "patrol_devices" pd ON pd."id" = pa."deviceId"
WHERE pd."assetId" IS NOT NULL
  AND pa."validFrom" <= CURRENT_DATE
  AND (pa."validUntil" IS NULL OR pa."validUntil" >= CURRENT_DATE)
ON CONFLICT ("routeId", "assetId") DO NOTHING;

-- Copiar contractId desde el puesto del dispositivo si la ruta no lo tiene
UPDATE "patrol_routes" pr
SET "contractId" = cl."contractId"
FROM "patrol_assignments" pa
JOIN "patrol_devices" pd ON pd."id" = pa."deviceId"
JOIN "positions" pos ON pos."id" = pd."positionId"
JOIN "contract_locations" cl ON cl."id" = pos."locationId"
WHERE pr."id" = pa."routeId"
  AND pr."contractId" IS NULL
  AND pd."positionId" IS NOT NULL
  AND pa."validFrom" <= CURRENT_DATE
  AND (pa."validUntil" IS NULL OR pa."validUntil" >= CURRENT_DATE);
