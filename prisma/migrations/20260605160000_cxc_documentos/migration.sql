-- CreateEnum
CREATE TYPE "CxcDocumentoStatus" AS ENUM ('PENDIENTE', 'COBRADO');

-- CreateTable
CREATE TABLE "cxc_documentos" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "facturaMensualId" TEXT,
    "companySapCode" TEXT NOT NULL,
    "companyCode" TEXT,
    "documentNumber" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "repeats" TEXT,
    "docType" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3),
    "servicePeriodDate" TIMESTAMP(3),
    "montoOriginal" DECIMAL(15,2),
    "saldo" DECIMAL(15,2) NOT NULL,
    "clientSapCode" TEXT,
    "clientName" TEXT NOT NULL,
    "plazoDays" INTEGER,
    "diasVencido" INTEGER,
    "diasParaVencer" INTEGER,
    "montoVencido" DECIMAL(15,2),
    "revisarDias" INTEGER,
    "dueDate" TIMESTAMP(3),
    "cxcExpectedPaymentDate" TIMESTAMP(3),
    "provisionalReceiptNumber" TEXT,
    "provisionalPaymentAmount" DECIMAL(15,2),
    "cxcObservations" TEXT,
    "status" "CxcDocumentoStatus" NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMP(3),
    "lastPaymentReviewAt" TIMESTAMP(3),
    "lastDueReminderEmailAt" TIMESTAMP(3),
    "lastCollectionEmailAt" TIMESTAMP(3),
    "collectionEmailCount" INTEGER NOT NULL DEFAULT 0,
    "isReajuste" BOOLEAN NOT NULL DEFAULT false,
    "importSheet" TEXT,
    "importSheetRow" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cxc_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cxc_documentos_companySapCode_documentNumber_key" ON "cxc_documentos"("companySapCode", "documentNumber");

-- CreateIndex
CREATE INDEX "cxc_documentos_status_idx" ON "cxc_documentos"("status");

-- CreateIndex
CREATE INDEX "cxc_documentos_contractId_idx" ON "cxc_documentos"("contractId");

-- CreateIndex
CREATE INDEX "cxc_documentos_docType_idx" ON "cxc_documentos"("docType");

-- AddForeignKey
ALTER TABLE "cxc_documentos" ADD CONSTRAINT "cxc_documentos_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cxc_documentos" ADD CONSTRAINT "cxc_documentos_facturaMensualId_fkey" FOREIGN KEY ("facturaMensualId") REFERENCES "facturas_mensuales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
