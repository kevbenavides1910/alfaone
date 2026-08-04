-- Programa anual de auditorías (F-SIG-21)

CREATE TYPE "AuditProgramStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE "AuditProgramPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AuditProgramItemStatus" AS ENUM ('PLANNED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'DEFERRED');

CREATE TABLE "sig_audit_programs" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AuditProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_audit_programs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_audit_programs_year_key" ON "sig_audit_programs"("year");
CREATE INDEX "sig_audit_programs_status_idx" ON "sig_audit_programs"("status");
ALTER TABLE "sig_audit_programs" ADD CONSTRAINT "sig_audit_programs_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_audit_programs" ADD CONSTRAINT "sig_audit_programs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sig_audit_program_items" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "processId" TEXT,
    "procedureId" TEXT,
    "plannedMonth" INTEGER NOT NULL,
    "plannedQuarter" INTEGER NOT NULL,
    "priority" "AuditProgramPriority" NOT NULL DEFAULT 'MEDIUM',
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "priorityReason" TEXT,
    "scope" TEXT,
    "objective" TEXT,
    "notes" TEXT,
    "status" "AuditProgramItemStatus" NOT NULL DEFAULT 'PLANNED',
    "auditorId" TEXT,
    "linkedAuditId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_audit_program_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sig_audit_program_items_programId_idx" ON "sig_audit_program_items"("programId");
CREATE INDEX "sig_audit_program_items_processId_idx" ON "sig_audit_program_items"("processId");
CREATE INDEX "sig_audit_program_items_procedureId_idx" ON "sig_audit_program_items"("procedureId");
CREATE INDEX "sig_audit_program_items_plannedMonth_idx" ON "sig_audit_program_items"("plannedMonth");
CREATE INDEX "sig_audit_program_items_priority_idx" ON "sig_audit_program_items"("priority");
CREATE INDEX "sig_audit_program_items_status_idx" ON "sig_audit_program_items"("status");
CREATE INDEX "sig_audit_program_items_linkedAuditId_idx" ON "sig_audit_program_items"("linkedAuditId");

ALTER TABLE "sig_audit_program_items" ADD CONSTRAINT "sig_audit_program_items_programId_fkey" FOREIGN KEY ("programId") REFERENCES "sig_audit_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_audit_program_items" ADD CONSTRAINT "sig_audit_program_items_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_audit_program_items" ADD CONSTRAINT "sig_audit_program_items_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "sig_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_audit_program_items" ADD CONSTRAINT "sig_audit_program_items_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_audit_program_items" ADD CONSTRAINT "sig_audit_program_items_linkedAuditId_fkey" FOREIGN KEY ("linkedAuditId") REFERENCES "sig_audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
