-- CreateEnum
CREATE TYPE "AuditChecklistResult" AS ENUM ('PENDING', 'COMPLIES', 'NON_COMPLIES', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "sig_audit_checklist_items" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "requirement" TEXT,
    "result" "AuditChecklistResult" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "evidence" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sig_audit_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sig_audit_checklist_items_auditId_idx" ON "sig_audit_checklist_items"("auditId");

-- CreateIndex
CREATE INDEX "sig_audit_checklist_items_result_idx" ON "sig_audit_checklist_items"("result");

-- AddForeignKey
ALTER TABLE "sig_audit_checklist_items" ADD CONSTRAINT "sig_audit_checklist_items_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "sig_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sig_audit_checklist_items" ADD CONSTRAINT "sig_audit_checklist_items_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
