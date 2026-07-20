-- Fase 1: Índices compuestos para consultas frecuentes de Expense y DeferredExpense
-- Mejora las queries que filtran por empresa + período simultáneamente

-- Expense: consulta principal de listado filtra (company, periodMonth) y (company, approvalStatus)
CREATE INDEX IF NOT EXISTS "expenses_company_period_month_idx" ON "expenses"("company", "periodMonth");
CREATE INDEX IF NOT EXISTS "expenses_company_approval_status_idx" ON "expenses"("company", "approvalStatus");

-- DeferredExpense: mismo patrón de filtrado (company + periodMonth)
CREATE INDEX IF NOT EXISTS "deferred_expenses_company_period_month_idx" ON "deferred_expenses"("company", "periodMonth");
