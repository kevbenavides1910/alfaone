-- Matriz de requisitos legales / reglamentarios del SIG

CREATE TYPE "SigLegalComplianceStatus" AS ENUM ('COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'NOT_EVALUATED', 'NOT_APPLICABLE');

CREATE TABLE "sig_legal_requirements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "legalSource" TEXT NOT NULL,
    "authority" TEXT,
    "articleRef" TEXT,
    "jurisdiction" TEXT DEFAULT 'CR',
    "processId" TEXT,
    "ownerUserId" TEXT,
    "complianceStatus" "SigLegalComplianceStatus" NOT NULL DEFAULT 'NOT_EVALUATED',
    "evaluationNotes" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "lastEvaluatedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_legal_requirements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_legal_requirements_code_key" ON "sig_legal_requirements"("code");
CREATE INDEX "sig_legal_requirements_processId_idx" ON "sig_legal_requirements"("processId");
CREATE INDEX "sig_legal_requirements_complianceStatus_idx" ON "sig_legal_requirements"("complianceStatus");
CREATE INDEX "sig_legal_requirements_jurisdiction_idx" ON "sig_legal_requirements"("jurisdiction");
CREATE INDEX "sig_legal_requirements_ownerUserId_idx" ON "sig_legal_requirements"("ownerUserId");
CREATE INDEX "sig_legal_requirements_nextReviewDate_idx" ON "sig_legal_requirements"("nextReviewDate");
CREATE INDEX "sig_legal_requirements_effectiveUntil_idx" ON "sig_legal_requirements"("effectiveUntil");

ALTER TABLE "sig_legal_requirements" ADD CONSTRAINT "sig_legal_requirements_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_legal_requirements" ADD CONSTRAINT "sig_legal_requirements_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_legal_requirements" ADD CONSTRAINT "sig_legal_requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sig_legal_processes" (
    "id" TEXT NOT NULL,
    "legalId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_legal_processes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_legal_processes_legalId_processId_key" ON "sig_legal_processes"("legalId", "processId");
CREATE INDEX "sig_legal_processes_processId_idx" ON "sig_legal_processes"("processId");
ALTER TABLE "sig_legal_processes" ADD CONSTRAINT "sig_legal_processes_legalId_fkey" FOREIGN KEY ("legalId") REFERENCES "sig_legal_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_legal_processes" ADD CONSTRAINT "sig_legal_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_legal_documents" (
    "id" TEXT NOT NULL,
    "legalId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_legal_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_legal_documents_legalId_documentId_key" ON "sig_legal_documents"("legalId", "documentId");
CREATE INDEX "sig_legal_documents_documentId_idx" ON "sig_legal_documents"("documentId");
ALTER TABLE "sig_legal_documents" ADD CONSTRAINT "sig_legal_documents_legalId_fkey" FOREIGN KEY ("legalId") REFERENCES "sig_legal_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_legal_documents" ADD CONSTRAINT "sig_legal_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sig_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_legal_controls" (
    "id" TEXT NOT NULL,
    "legalId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_legal_controls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_legal_controls_legalId_controlId_key" ON "sig_legal_controls"("legalId", "controlId");
CREATE INDEX "sig_legal_controls_controlId_idx" ON "sig_legal_controls"("controlId");
ALTER TABLE "sig_legal_controls" ADD CONSTRAINT "sig_legal_controls_legalId_fkey" FOREIGN KEY ("legalId") REFERENCES "sig_legal_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_legal_controls" ADD CONSTRAINT "sig_legal_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "sig_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_legal_evidences" (
    "id" TEXT NOT NULL,
    "legalId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_legal_evidences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_legal_evidences_legalId_evidenceId_key" ON "sig_legal_evidences"("legalId", "evidenceId");
CREATE INDEX "sig_legal_evidences_evidenceId_idx" ON "sig_legal_evidences"("evidenceId");
ALTER TABLE "sig_legal_evidences" ADD CONSTRAINT "sig_legal_evidences_legalId_fkey" FOREIGN KEY ("legalId") REFERENCES "sig_legal_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_legal_evidences" ADD CONSTRAINT "sig_legal_evidences_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
