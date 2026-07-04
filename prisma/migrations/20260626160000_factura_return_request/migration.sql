-- Solicitud / aprobación de regresión de facturas

CREATE TYPE "FacturaReturnRequestStatus" AS ENUM ('PENDING', 'REJECTED');

ALTER TABLE "facturas_mensuales"
  ADD COLUMN IF NOT EXISTS "returnRequestStatus" "FacturaReturnRequestStatus",
  ADD COLUMN IF NOT EXISTS "returnRequestReason" TEXT,
  ADD COLUMN IF NOT EXISTS "returnRequestRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returnRequestRequestedById" TEXT,
  ADD COLUMN IF NOT EXISTS "returnRequestReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returnRequestReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "returnRequestReviewNote" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_mensuales_returnRequestRequestedById_fkey'
  ) THEN
    ALTER TABLE "facturas_mensuales"
      ADD CONSTRAINT "facturas_mensuales_returnRequestRequestedById_fkey"
      FOREIGN KEY ("returnRequestRequestedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'facturas_mensuales_returnRequestReviewedById_fkey'
  ) THEN
    ALTER TABLE "facturas_mensuales"
      ADD CONSTRAINT "facturas_mensuales_returnRequestReviewedById_fkey"
      FOREIGN KEY ("returnRequestReviewedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "facturas_mensuales_returnRequestStatus_idx"
  ON "facturas_mensuales"("returnRequestStatus");
