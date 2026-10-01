-- Calendario de documentos legales (aditivo; no altera payments).

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('GARANTIA', 'LICENCIA', 'PATENTE', 'CONSTANCIA', 'POLIZA', 'OTRO');

-- CreateEnum
CREATE TYPE "LegalReminderOffsetUnit" AS ENUM ('DAYS', 'MONTHS');

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "otherTypeLabel" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "company" TEXT,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "responsibleUserId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_reminders" (
    "id" TEXT NOT NULL,
    "legalDocumentId" TEXT NOT NULL,
    "offsetValue" INTEGER NOT NULL,
    "offsetUnit" "LegalReminderOffsetUnit" NOT NULL,
    "sendOn" DATE NOT NULL,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_document_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_attachments" (
    "id" TEXT NOT NULL,
    "legalDocumentId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_document_change_logs" (
    "id" TEXT NOT NULL,
    "legalDocumentId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_document_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_documents_dueDate_idx" ON "legal_documents"("dueDate");

-- CreateIndex
CREATE INDEX "legal_documents_company_idx" ON "legal_documents"("company");

-- CreateIndex
CREATE INDEX "legal_documents_paid_idx" ON "legal_documents"("paid");

-- CreateIndex
CREATE INDEX "legal_documents_type_idx" ON "legal_documents"("type");

-- CreateIndex
CREATE INDEX "legal_documents_responsibleUserId_idx" ON "legal_documents"("responsibleUserId");

-- CreateIndex
CREATE INDEX "legal_document_reminders_sendOn_sentAt_idx" ON "legal_document_reminders"("sendOn", "sentAt");

-- CreateIndex
CREATE INDEX "legal_document_reminders_legalDocumentId_idx" ON "legal_document_reminders"("legalDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "legal_doc_reminder_offset_key" ON "legal_document_reminders"("legalDocumentId", "offsetValue", "offsetUnit");

-- CreateIndex
CREATE INDEX "legal_document_attachments_legalDocumentId_idx" ON "legal_document_attachments"("legalDocumentId");

-- CreateIndex
CREATE INDEX "legal_document_attachments_uploadedById_idx" ON "legal_document_attachments"("uploadedById");

-- CreateIndex
CREATE INDEX "legal_document_change_logs_legalDocumentId_createdAt_idx" ON "legal_document_change_logs"("legalDocumentId", "createdAt");

-- CreateIndex
CREATE INDEX "legal_document_change_logs_changedById_idx" ON "legal_document_change_logs"("changedById");

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_reminders" ADD CONSTRAINT "legal_document_reminders_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_attachments" ADD CONSTRAINT "legal_document_attachments_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_attachments" ADD CONSTRAINT "legal_document_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_change_logs" ADD CONSTRAINT "legal_document_change_logs_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_document_change_logs" ADD CONSTRAINT "legal_document_change_logs_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
