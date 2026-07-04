-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "monthlyInvoicesCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "facturas_mensuales" ADD COLUMN "monthlyInvoicesCountCopied" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "factura_mensual_emisiones" (
    "id" TEXT NOT NULL,
    "facturaMensualId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "invoiceNumber" TEXT,
    "documentNumber" TEXT,
    "invoiceReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factura_mensual_emisiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "factura_mensual_emisiones_facturaMensualId_sortOrder_key" ON "factura_mensual_emisiones"("facturaMensualId", "sortOrder");

-- CreateIndex
CREATE INDEX "factura_mensual_emisiones_facturaMensualId_idx" ON "factura_mensual_emisiones"("facturaMensualId");

-- AddForeignKey
ALTER TABLE "factura_mensual_emisiones" ADD CONSTRAINT "factura_mensual_emisiones_facturaMensualId_fkey" FOREIGN KEY ("facturaMensualId") REFERENCES "facturas_mensuales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: una emisión por factura mensual existente
INSERT INTO "factura_mensual_emisiones" (
    "id",
    "facturaMensualId",
    "sortOrder",
    "invoiceNumber",
    "documentNumber",
    "invoiceReceivedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    fm."id" || '_e0',
    fm."id",
    0,
    fm."invoiceNumber",
    fm."documentNumber",
    fm."invoiceReceivedAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "facturas_mensuales" fm;
