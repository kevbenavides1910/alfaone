-- Índices para acelerar agregaciones del reporte anual (filtro por rango de periodMonth).
CREATE INDEX IF NOT EXISTS "expenses_periodMonth_idx" ON "expenses"("periodMonth");
CREATE INDEX IF NOT EXISTS "expenses_periodMonth_contractId_idx" ON "expenses"("periodMonth", "contractId");
CREATE INDEX IF NOT EXISTS "expenses_periodMonth_isDeferred_idx" ON "expenses"("periodMonth", "isDeferred");
CREATE INDEX IF NOT EXISTS "deferred_expenses_periodMonth_idx" ON "deferred_expenses"("periodMonth");
