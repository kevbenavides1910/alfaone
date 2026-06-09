-- AlterTable
ALTER TABLE "sig_document_versions" ADD COLUMN "assignedApproverId" TEXT;

-- CreateIndex
CREATE INDEX "sig_document_versions_assignedApproverId_idx" ON "sig_document_versions"("assignedApproverId");

-- AddForeignKey
ALTER TABLE "sig_document_versions" ADD CONSTRAINT "sig_document_versions_assignedApproverId_fkey" FOREIGN KEY ("assignedApproverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
