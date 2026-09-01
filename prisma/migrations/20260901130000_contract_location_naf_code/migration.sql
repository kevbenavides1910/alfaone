-- Código NAF por ubicación de contrato (sincronización con Operaciones / .6)
ALTER TABLE "contract_locations" ADD COLUMN IF NOT EXISTS "nafUbicacionCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "contract_locations_contractId_nafUbicacionCode_key"
  ON "contract_locations"("contractId", "nafUbicacionCode");

CREATE INDEX IF NOT EXISTS "contract_locations_nafUbicacionCode_idx"
  ON "contract_locations"("nafUbicacionCode");
