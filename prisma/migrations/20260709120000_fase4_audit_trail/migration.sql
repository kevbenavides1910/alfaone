-- Fase 4: Audit trail — soft-delete en Expense y Asset, índice compuesto en audit_logs

-- Expense: soft-delete + trazabilidad de quién modificó/eliminó
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_deletedAt_idx" ON "expenses"("deletedAt");

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Asset: soft-delete + trazabilidad
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;

CREATE INDEX IF NOT EXISTS "assets_deletedAt_idx" ON "assets"("deletedAt");

ALTER TABLE "assets"
  ADD CONSTRAINT "assets_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assets"
  ADD CONSTRAINT "assets_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AuditLog: índice compuesto para consultas por entidad
CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
