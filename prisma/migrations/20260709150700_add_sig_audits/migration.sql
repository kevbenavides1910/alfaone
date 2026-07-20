-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "ActionPlanStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "sig_audits" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
    "scope" TEXT,
    "objective" TEXT,
    "notes" TEXT,
    "auditorId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sig_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sig_audit_findings" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sig_audit_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sig_action_plans" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibleName" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionPlanStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sig_action_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sig_follow_ups" (
    "id" TEXT NOT NULL,
    "actionPlanId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" "ActionPlanStatus" NOT NULL,
    "followUpDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sig_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sig_audits_procedureId_year_quarter_key" ON "sig_audits"("procedureId", "year", "quarter");

-- CreateIndex
CREATE INDEX "sig_audits_year_quarter_idx" ON "sig_audits"("year", "quarter");

-- CreateIndex
CREATE INDEX "sig_audits_status_idx" ON "sig_audits"("status");

-- CreateIndex
CREATE INDEX "sig_audits_auditorId_idx" ON "sig_audits"("auditorId");

-- CreateIndex
CREATE INDEX "sig_audit_findings_auditId_idx" ON "sig_audit_findings"("auditId");

-- CreateIndex
CREATE INDEX "sig_audit_findings_status_idx" ON "sig_audit_findings"("status");

-- CreateIndex
CREATE INDEX "sig_action_plans_findingId_idx" ON "sig_action_plans"("findingId");

-- CreateIndex
CREATE INDEX "sig_action_plans_status_idx" ON "sig_action_plans"("status");

-- CreateIndex
CREATE INDEX "sig_action_plans_dueDate_idx" ON "sig_action_plans"("dueDate");

-- CreateIndex
CREATE INDEX "sig_follow_ups_actionPlanId_idx" ON "sig_follow_ups"("actionPlanId");

-- CreateIndex
CREATE INDEX "sig_follow_ups_followUpDate_idx" ON "sig_follow_ups"("followUpDate");

-- AddForeignKey
ALTER TABLE "sig_audits" ADD CONSTRAINT "sig_audits_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "sig_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_audits" ADD CONSTRAINT "sig_audits_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_audits" ADD CONSTRAINT "sig_audits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_audit_findings" ADD CONSTRAINT "sig_audit_findings_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "sig_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_audit_findings" ADD CONSTRAINT "sig_audit_findings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_action_plans" ADD CONSTRAINT "sig_action_plans_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "sig_audit_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_action_plans" ADD CONSTRAINT "sig_action_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_follow_ups" ADD CONSTRAINT "sig_follow_ups_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "sig_action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_follow_ups" ADD CONSTRAINT "sig_follow_ups_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
