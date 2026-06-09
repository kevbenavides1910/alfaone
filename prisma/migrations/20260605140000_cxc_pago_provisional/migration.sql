-- AlterTable
ALTER TABLE "facturas_mensuales" ADD COLUMN "cxcExpectedPaymentDate" TIMESTAMP(3);
ALTER TABLE "facturas_mensuales" ADD COLUMN "provisionalReceiptNumber" TEXT;
ALTER TABLE "facturas_mensuales" ADD COLUMN "provisionalPaymentAmount" DECIMAL(15,2);
