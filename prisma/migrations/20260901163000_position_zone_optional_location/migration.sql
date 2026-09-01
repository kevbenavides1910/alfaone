-- Zona en puesto (NAF); ubicación opcional; contrato directo para puestos sin ubicación.

ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

UPDATE "positions" p
SET "contractId" = cl."contractId"
FROM "contract_locations" cl
WHERE p."locationId" = cl.id AND p."contractId" IS NULL;

ALTER TABLE "positions" ALTER COLUMN "locationId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "positions_zoneId_idx" ON "positions"("zoneId");
CREATE INDEX IF NOT EXISTS "positions_contractId_idx" ON "positions"("contractId");

DO $$ BEGIN
  ALTER TABLE "positions" ADD CONSTRAINT "positions_zoneId_fkey"
    FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "positions" ADD CONSTRAINT "positions_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE "positions" p
SET "zoneId" = cl."zoneId"
FROM "contract_locations" cl
WHERE p."locationId" = cl.id
  AND cl."nafSyncGroupKey" IS NOT NULL
  AND p."zoneId" IS NULL;

UPDATE "positions" p
SET "locationId" = NULL
FROM "contract_locations" cl
WHERE p."locationId" = cl.id
  AND cl."nafSyncGroupKey" IS NOT NULL;

DELETE FROM "contract_locations" WHERE "nafSyncGroupKey" IS NOT NULL;

DROP INDEX IF EXISTS "positions_locationId_nafUbicacionCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "positions_contractId_nafUbicacionCode_key"
  ON "positions"("contractId", "nafUbicacionCode") WHERE "nafUbicacionCode" IS NOT NULL;
