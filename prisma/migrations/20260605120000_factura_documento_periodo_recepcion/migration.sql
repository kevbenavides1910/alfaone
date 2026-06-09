-- AlterTable
ALTER TABLE "facturas_mensuales" ADD COLUMN "documentNumber" TEXT;
ALTER TABLE "facturas_mensuales" ADD COLUMN "billingPeriodFromDayCopied" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "facturas_mensuales" ADD COLUMN "billingPeriodToDayCopied" INTEGER NOT NULL DEFAULT 31;
ALTER TABLE "facturas_mensuales" ADD COLUMN "servicePeriodFromDate" TIMESTAMP(3);
ALTER TABLE "facturas_mensuales" ADD COLUMN "servicePeriodToDate" TIMESTAMP(3);
ALTER TABLE "facturas_mensuales" ADD COLUMN "invoiceReceivedAt" TIMESTAMP(3);

-- Copiar días de periodo desde el contrato vigente
UPDATE "facturas_mensuales" AS f
SET
  "billingPeriodFromDayCopied" = c."billingPeriodFromDay",
  "billingPeriodToDayCopied" = c."billingPeriodToDay"
FROM "contracts" AS c
WHERE c."id" = f."contractId";
