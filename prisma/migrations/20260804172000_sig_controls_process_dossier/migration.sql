-- SIG controls + process dossier relations

CREATE TYPE "SigControlStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_REVIEW');

CREATE TABLE "sig_controls" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SigControlStatus" NOT NULL DEFAULT 'ACTIVE',
    "processId" TEXT,
    "ownerUserId" TEXT,
    "evidenceIntervalDays" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_controls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_controls_code_key" ON "sig_controls"("code");
CREATE INDEX "sig_controls_processId_idx" ON "sig_controls"("processId");
CREATE INDEX "sig_controls_status_idx" ON "sig_controls"("status");
CREATE INDEX "sig_controls_ownerUserId_idx" ON "sig_controls"("ownerUserId");

ALTER TABLE "sig_controls" ADD CONSTRAINT "sig_controls_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_controls" ADD CONSTRAINT "sig_controls_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_controls" ADD CONSTRAINT "sig_controls_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sig_control_requirements" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_control_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_control_requirements_controlId_requirementId_key" ON "sig_control_requirements"("controlId", "requirementId");
CREATE INDEX "sig_control_requirements_requirementId_idx" ON "sig_control_requirements"("requirementId");
ALTER TABLE "sig_control_requirements" ADD CONSTRAINT "sig_control_requirements_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "sig_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_control_requirements" ADD CONSTRAINT "sig_control_requirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "sig_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_control_processes" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_control_processes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_control_processes_controlId_processId_key" ON "sig_control_processes"("controlId", "processId");
CREATE INDEX "sig_control_processes_processId_idx" ON "sig_control_processes"("processId");
ALTER TABLE "sig_control_processes" ADD CONSTRAINT "sig_control_processes_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "sig_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_control_processes" ADD CONSTRAINT "sig_control_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_control_documents" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_control_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_control_documents_controlId_documentId_key" ON "sig_control_documents"("controlId", "documentId");
CREATE INDEX "sig_control_documents_documentId_idx" ON "sig_control_documents"("documentId");
ALTER TABLE "sig_control_documents" ADD CONSTRAINT "sig_control_documents_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "sig_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_control_documents" ADD CONSTRAINT "sig_control_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sig_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_control_evidences" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_control_evidences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_control_evidences_controlId_evidenceId_key" ON "sig_control_evidences"("controlId", "evidenceId");
CREATE INDEX "sig_control_evidences_evidenceId_idx" ON "sig_control_evidences"("evidenceId");
ALTER TABLE "sig_control_evidences" ADD CONSTRAINT "sig_control_evidences_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "sig_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_control_evidences" ADD CONSTRAINT "sig_control_evidences_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
