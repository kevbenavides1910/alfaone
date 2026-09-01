-- Código NAF operativo por zona (catálogo 89-Zonas / VIOPUBICACION_ZONA)
ALTER TABLE "zones" ADD COLUMN IF NOT EXISTS "nafZonaCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "zones_nafZonaCode_key" ON "zones"("nafZonaCode");

CREATE INDEX IF NOT EXISTS "zones_nafZonaCode_idx" ON "zones"("nafZonaCode");
