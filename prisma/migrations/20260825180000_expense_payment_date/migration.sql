-- Fecha de pago en gastos (distinta del período contable periodMonth).
ALTER TABLE "expenses" ADD COLUMN "paymentDate" DATE;

-- Histórico: usar el día de registro, no el día 1 del período.
UPDATE "expenses"
SET "paymentDate" = ("createdAt" AT TIME ZONE 'UTC')::date
WHERE "paymentDate" IS NULL;

-- Recalendarizar pagos vinculados a gastos.
UPDATE "payments" p
SET "paymentDate" = e."paymentDate"
FROM "expenses" e
WHERE p."expenseId" = e.id
  AND p."source" = 'EXPENSE'
  AND e."paymentDate" IS NOT NULL;
