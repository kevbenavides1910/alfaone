-- Gastos liquidados por un pago consolidado (multi-OC) salen de la cola proveedores.
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "settledByPaymentId" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_settledByPaymentId_idx" ON "expenses"("settledByPaymentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_settledByPaymentId_fkey'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_settledByPaymentId_fkey"
      FOREIGN KEY ("settledByPaymentId") REFERENCES "payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
