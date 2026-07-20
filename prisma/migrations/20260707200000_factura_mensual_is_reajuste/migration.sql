-- Clasificación mensual vs reajuste en facturación mensual.
ALTER TABLE "facturas_mensuales" ADD COLUMN IF NOT EXISTS "isReajuste" BOOLEAN NOT NULL DEFAULT false;
