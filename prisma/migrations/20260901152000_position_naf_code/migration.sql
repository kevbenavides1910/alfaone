-- Puestos NAF: código en positions; ubicaciones padre agrupadas por zona (nafSyncGroupKey).

ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "nafUbicacionCode" TEXT;

CREATE INDEX IF NOT EXISTS "positions_nafUbicacionCode_idx" ON "positions"("nafUbicacionCode");

ALTER TABLE "contract_locations" ADD COLUMN IF NOT EXISTS "nafSyncGroupKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "contract_locations_contractId_nafSyncGroupKey_key"
  ON "contract_locations"("contractId", "nafSyncGroupKey")
  WHERE "nafSyncGroupKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "positions_locationId_nafUbicacionCode_key"
  ON "positions"("locationId", "nafUbicacionCode")
  WHERE "nafUbicacionCode" IS NOT NULL;
