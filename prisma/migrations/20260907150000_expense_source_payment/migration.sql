-- Gastos creados desde un pago ya marcado Pagado («Pendientes de asignar»).
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "sourcePaymentId" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_sourcePaymentId_idx" ON "expenses"("sourcePaymentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_sourcePaymentId_fkey'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_sourcePaymentId_fkey"
      FOREIGN KEY ("sourcePaymentId") REFERENCES "payments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
