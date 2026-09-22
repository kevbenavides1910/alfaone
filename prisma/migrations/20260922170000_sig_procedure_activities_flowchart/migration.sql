-- Secciones fijas Alfa: actividades tabulares + diagrama de flujo

ALTER TABLE "sig_procedure_bodies" ADD COLUMN IF NOT EXISTS "flowchartFileName" TEXT;
ALTER TABLE "sig_procedure_bodies" ADD COLUMN IF NOT EXISTS "flowchartMimeType" TEXT;
ALTER TABLE "sig_procedure_bodies" ADD COLUMN IF NOT EXISTS "flowchartStoragePath" TEXT;
ALTER TABLE "sig_procedure_bodies" ADD COLUMN IF NOT EXISTS "flowchartFileSizeBytes" INTEGER;

ALTER TABLE "sig_procedure_stages" ADD COLUMN IF NOT EXISTS "sectionKey" TEXT;
CREATE INDEX IF NOT EXISTS "sig_procedure_stages_versionId_sectionKey_idx" ON "sig_procedure_stages"("versionId", "sectionKey");

CREATE TABLE IF NOT EXISTS "sig_procedure_activities" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "documents" TEXT,
    "responsible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_procedure_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sig_procedure_activities_versionId_sortOrder_idx" ON "sig_procedure_activities"("versionId", "sortOrder");

ALTER TABLE "sig_procedure_activities" DROP CONSTRAINT IF EXISTS "sig_procedure_activities_versionId_fkey";
ALTER TABLE "sig_procedure_activities" ADD CONSTRAINT "sig_procedure_activities_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "sig_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
