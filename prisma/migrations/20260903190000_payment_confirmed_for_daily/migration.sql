-- APEX solo entra al calendario diario tras confirmar desde «Pagos fijos».
-- Los ya marcados en verde (paid) se preservan como confirmados.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "confirmedForDaily" BOOLEAN NOT NULL DEFAULT false;

UPDATE "payments"
SET "confirmedForDaily" = true
WHERE paid = true AND "confirmedForDaily" = false;

CREATE INDEX IF NOT EXISTS "payments_confirmedForDaily_idx" ON "payments"("confirmedForDaily");
