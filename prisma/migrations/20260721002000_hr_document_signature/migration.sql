-- AlterTable
ALTER TABLE "hr_document_request_settings"
ADD COLUMN IF NOT EXISTS "documentSignaturePath" TEXT;

-- Default signature path (file must exist under branding upload root)
UPDATE "hr_document_request_settings"
SET "documentSignaturePath" = 'branding/hr-document-signature.png'
WHERE "id" = 'default'
  AND ("documentSignaturePath" IS NULL OR "documentSignaturePath" = '');
