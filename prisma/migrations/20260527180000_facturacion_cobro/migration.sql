-- CreateEnum
CREATE TYPE "FacturaMensualStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'FACTURADO', 'COBRADO');

-- CreateEnum
CREATE TYPE "FacturaRequisitoStatus" AS ENUM ('PENDIENTE', 'COMPLETADO');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "ivaPct" DECIMAL(5,2) NOT NULL DEFAULT 13;
ALTER TABLE "contracts" ADD COLUMN "billingDay" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "facturas_mensuales" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "expectedIssueDate" TIMESTAMP(3) NOT NULL,
    "status" "FacturaMensualStatus" NOT NULL DEFAULT 'PENDIENTE',
    "finalNotes" TEXT,
    "observationLog" TEXT,
    "subtotalCopied" DECIMAL(15,2) NOT NULL,
    "ivaPctCopied" DECIMAL(5,2) NOT NULL,
    "totalCalculated" DECIMAL(15,2) NOT NULL,
    "clientNameCopied" TEXT NOT NULL,
    "companyCodeCopied" TEXT NOT NULL,
    "billingDayCopied" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "facturas_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura_requisitos" (
    "id" TEXT NOT NULL,
    "facturaMensualId" TEXT NOT NULL,
    "requirementName" TEXT NOT NULL,
    "status" "FacturaRequisitoStatus" NOT NULL DEFAULT 'PENDIENTE',
    "filePath" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factura_requisitos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facturas_mensuales_periodYear_periodMonth_idx" ON "facturas_mensuales"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "facturas_mensuales_status_idx" ON "facturas_mensuales"("status");

-- CreateIndex
CREATE INDEX "facturas_mensuales_contractId_idx" ON "facturas_mensuales"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_mensuales_contractId_periodYear_periodMonth_key" ON "facturas_mensuales"("contractId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "factura_requisitos_facturaMensualId_idx" ON "factura_requisitos"("facturaMensualId");

-- AddForeignKey
ALTER TABLE "facturas_mensuales" ADD CONSTRAINT "facturas_mensuales_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factura_requisitos" ADD CONSTRAINT "factura_requisitos_facturaMensualId_fkey" FOREIGN KEY ("facturaMensualId") REFERENCES "facturas_mensuales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
