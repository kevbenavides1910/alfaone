-- AlterEnum
ALTER TYPE "LegalDocumentType" ADD VALUE IF NOT EXISTS 'CERTIFICACION';
ALTER TYPE "LegalDocumentType" ADD VALUE IF NOT EXISTS 'CEDULA';

-- AlterTable
ALTER TABLE "legal_documents" ADD COLUMN "cedulaCondition" TEXT;
