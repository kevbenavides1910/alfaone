-- PDF oficial adjunto a cada norma del SIG
ALTER TABLE "sig_standards"
  ADD COLUMN IF NOT EXISTS "pdfFileName" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfStoragePath" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfSizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "pdfUploadedAt" TIMESTAMP(3);
