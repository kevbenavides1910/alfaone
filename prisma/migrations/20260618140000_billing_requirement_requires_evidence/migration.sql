-- AlterTable
ALTER TABLE "contract_billing_requirements" ADD COLUMN "requiresEvidence" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "factura_requisitos" ADD COLUMN "requiresEvidenceCopied" BOOLEAN NOT NULL DEFAULT true;
