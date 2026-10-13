-- Cartel de la licitación en el contrato (uno por contrato)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "cartelFileName" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "cartelMimeType" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "cartelStoragePath" TEXT;
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "cartelUploadedAt" TIMESTAMP(3);
