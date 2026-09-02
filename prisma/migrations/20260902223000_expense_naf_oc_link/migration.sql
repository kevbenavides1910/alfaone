-- AlterTable
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "nafOcNoCia" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "nafOcNoOrden" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "nafOcNoDocu" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "nafOcLinkedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expenses_nafOcNoOrden_nafOcNoCia_idx" ON "expenses"("nafOcNoOrden", "nafOcNoCia");
