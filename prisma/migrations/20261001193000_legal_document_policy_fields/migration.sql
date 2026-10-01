-- Campos de póliza (texto libre). Aditivo.

ALTER TABLE "legal_documents" ADD COLUMN "policyPercentage" TEXT;
ALTER TABLE "legal_documents" ADD COLUMN "insuredAmountLabel" TEXT;
