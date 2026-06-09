-- AlterTable
ALTER TABLE "facturas_mensuales" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "facturas_mensuales" ADD COLUMN "lastPriceUpdateCopied" TIMESTAMP(3);

-- Backfill: vencimiento = emisión + 1 mes; precio = fecha de creación de la factura
UPDATE "facturas_mensuales"
SET "dueDate" = "expectedIssueDate" + INTERVAL '1 month'
WHERE "dueDate" IS NULL;

UPDATE "facturas_mensuales"
SET "lastPriceUpdateCopied" = "createdAt"
WHERE "lastPriceUpdateCopied" IS NULL;

ALTER TABLE "facturas_mensuales" ALTER COLUMN "dueDate" SET NOT NULL;
ALTER TABLE "facturas_mensuales" ALTER COLUMN "lastPriceUpdateCopied" SET NOT NULL;
