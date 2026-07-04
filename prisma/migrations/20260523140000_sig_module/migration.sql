-- CreateEnum
CREATE TYPE "SigDocumentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "SigAuditAction" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'REJECTED', 'REVISION_DATE_UPDATED', 'NEW_VERSION', 'SAME_VERSION_UPDATED', 'OBSOLETED');

-- CreateTable
CREATE TABLE "sig_document_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sig_document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sig_processes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sig_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sig_documents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "processId" TEXT,
    "company" TEXT,
    "status" "SigDocumentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "currentVersionId" TEXT,
    "revisionIntervalDays" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sig_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sig_document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "revisionDate" TIMESTAMP(3) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "changeSummary" TEXT,
    "status" "SigDocumentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "uploadedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sig_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sig_document_audit_logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT,
    "action" "SigAuditAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "notes" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sig_document_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sig_document_types_code_key" ON "sig_document_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sig_processes_code_key" ON "sig_processes"("code");

-- CreateIndex
CREATE INDEX "sig_processes_parentId_idx" ON "sig_processes"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "sig_documents_code_key" ON "sig_documents"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sig_documents_currentVersionId_key" ON "sig_documents"("currentVersionId");

-- CreateIndex
CREATE INDEX "sig_documents_documentTypeId_idx" ON "sig_documents"("documentTypeId");

-- CreateIndex
CREATE INDEX "sig_documents_processId_idx" ON "sig_documents"("processId");

-- CreateIndex
CREATE INDEX "sig_documents_status_idx" ON "sig_documents"("status");

-- CreateIndex
CREATE INDEX "sig_documents_company_idx" ON "sig_documents"("company");

-- CreateIndex
CREATE INDEX "sig_document_versions_documentId_idx" ON "sig_document_versions"("documentId");

-- CreateIndex
CREATE INDEX "sig_document_versions_status_idx" ON "sig_document_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sig_document_versions_documentId_versionNumber_key" ON "sig_document_versions"("documentId", "versionNumber");

-- CreateIndex
CREATE INDEX "sig_document_audit_logs_documentId_idx" ON "sig_document_audit_logs"("documentId");

-- CreateIndex
CREATE INDEX "sig_document_audit_logs_versionId_idx" ON "sig_document_audit_logs"("versionId");

-- CreateIndex
CREATE INDEX "sig_document_audit_logs_createdAt_idx" ON "sig_document_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "sig_processes" ADD CONSTRAINT "sig_processes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_documents" ADD CONSTRAINT "sig_documents_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "sig_document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_documents" ADD CONSTRAINT "sig_documents_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_documents" ADD CONSTRAINT "sig_documents_company_fkey" FOREIGN KEY ("company") REFERENCES "companies"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_documents" ADD CONSTRAINT "sig_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_documents" ADD CONSTRAINT "sig_documents_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "sig_document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_document_versions" ADD CONSTRAINT "sig_document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sig_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_document_versions" ADD CONSTRAINT "sig_document_versions_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_document_versions" ADD CONSTRAINT "sig_document_versions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_document_audit_logs" ADD CONSTRAINT "sig_document_audit_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sig_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_document_audit_logs" ADD CONSTRAINT "sig_document_audit_logs_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "sig_document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_document_audit_logs" ADD CONSTRAINT "sig_document_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tipos documentales iniciales
INSERT INTO "sig_document_types" ("id", "code", "name", "description", "sortOrder", "updatedAt") VALUES
  ('sigtype_procedimiento', 'PROCEDIMIENTO', 'Procedimiento', 'Procedimientos operativos y de calidad', 10, CURRENT_TIMESTAMP),
  ('sigtype_formulario', 'FORMULARIO', 'Formulario', 'Formatos y formularios oficiales', 20, CURRENT_TIMESTAMP),
  ('sigtype_instructivo', 'INSTRUCTIVO', 'Instructivo', 'Instructivos de trabajo', 30, CURRENT_TIMESTAMP),
  ('sigtype_manual', 'MANUAL', 'Manual', 'Manuales de operación o referencia', 40, CURRENT_TIMESTAMP),
  ('sigtype_registro', 'REGISTRO', 'Registro', 'Registros y evidencias documentales', 50, CURRENT_TIMESTAMP),
  ('sigtype_otro', 'OTRO', 'Otro', 'Otros documentos del sistema integrado', 99, CURRENT_TIMESTAMP);
