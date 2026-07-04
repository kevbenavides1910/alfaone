-- Monto solicitado y evidencia adjunta en solicitudes de cambio de monto

ALTER TABLE "facturas_mensuales"
  ADD COLUMN IF NOT EXISTS "returnRequestRequestedSubtotal" DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS "returnRequestEvidencePath" TEXT,
  ADD COLUMN IF NOT EXISTS "returnRequestEvidenceFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "returnRequestEvidenceMimeType" TEXT;
