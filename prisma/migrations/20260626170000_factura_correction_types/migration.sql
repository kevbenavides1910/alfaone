-- Tipos de corrección: documentación (directa) vs monto (con aprobación)

CREATE TYPE "FacturaCorrectionType" AS ENUM ('DOCUMENTATION', 'AMOUNT');

ALTER TABLE "facturas_mensuales"
  ADD COLUMN IF NOT EXISTS "returnRequestType" "FacturaCorrectionType",
  ADD COLUMN IF NOT EXISTS "activeCorrectionType" "FacturaCorrectionType",
  ADD COLUMN IF NOT EXISTS "lastCorrectionType" "FacturaCorrectionType";
