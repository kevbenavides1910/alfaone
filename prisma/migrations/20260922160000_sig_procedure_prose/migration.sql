-- Procedimientos en prosa: body, etapas y solicitudes de cambio

ALTER TYPE "SigAuditAction" ADD VALUE IF NOT EXISTS 'CHANGE_REQUESTED';
ALTER TYPE "SigAuditAction" ADD VALUE IF NOT EXISTS 'CONTENT_UPDATED';

CREATE TYPE "SigChangeRequestStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'IMPLEMENTED', 'CANCELLED');
CREATE TYPE "SigChangeRequestType" AS ENUM ('GENERAL', 'EDIT_STAGE', 'ADD_STAGE', 'REMOVE_STAGE');

CREATE TABLE "sig_procedure_bodies" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "objective" TEXT,
    "scope" TEXT,
    "responsibilities" TEXT,
    "definitions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_procedure_bodies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_procedure_bodies_versionId_key" ON "sig_procedure_bodies"("versionId");

ALTER TABLE "sig_procedure_bodies" ADD CONSTRAINT "sig_procedure_bodies_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "sig_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_procedure_stages" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "responsible" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_procedure_stages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sig_procedure_stages_versionId_sortOrder_idx" ON "sig_procedure_stages"("versionId", "sortOrder");

ALTER TABLE "sig_procedure_stages" ADD CONSTRAINT "sig_procedure_stages_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "sig_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_change_requests" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "SigChangeRequestStatus" NOT NULL DEFAULT 'OPEN',
    "type" "SigChangeRequestType" NOT NULL DEFAULT 'GENERAL',
    "description" TEXT NOT NULL,
    "targetStageId" TEXT,
    "proposedTitle" TEXT,
    "proposedBody" TEXT,
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sig_change_requests_documentId_status_idx" ON "sig_change_requests"("documentId", "status");
CREATE INDEX "sig_change_requests_requesterId_idx" ON "sig_change_requests"("requesterId");
CREATE INDEX "sig_change_requests_targetStageId_idx" ON "sig_change_requests"("targetStageId");

ALTER TABLE "sig_change_requests" ADD CONSTRAINT "sig_change_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sig_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_change_requests" ADD CONSTRAINT "sig_change_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sig_change_requests" ADD CONSTRAINT "sig_change_requests_targetStageId_fkey" FOREIGN KEY ("targetStageId") REFERENCES "sig_procedure_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_change_requests" ADD CONSTRAINT "sig_change_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
