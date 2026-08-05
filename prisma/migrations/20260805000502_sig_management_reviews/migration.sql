-- Revisión por la dirección (ISO 9001 9.3 / F-SIG-18 / F-SIG-19)

CREATE TYPE "SigManagementReviewStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'FOLLOW_UP', 'CLOSED');
CREATE TYPE "SigManagementReviewInputKey" AS ENUM (
  'PRIOR_ACTIONS',
  'CONTEXT_CHANGES',
  'CUSTOMER_FEEDBACK',
  'QUALITY_OBJECTIVES',
  'PROCESS_PERFORMANCE',
  'NONCONFORMITIES_CAPA',
  'MONITORING_MEASUREMENT',
  'AUDIT_RESULTS',
  'EXTERNAL_PROVIDERS',
  'RESOURCES',
  'RISKS_OPPORTUNITIES_EFFICACY',
  'IMPROVEMENT_OPPORTUNITIES'
);
CREATE TYPE "SigManagementReviewActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "sig_management_reviews" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SigManagementReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "location" TEXT,
    "attendees" TEXT,
    "agenda" TEXT,
    "minutesSummary" TEXT,
    "outputImprovements" TEXT,
    "outputQmsChanges" TEXT,
    "outputResourceNeeds" TEXT,
    "formCode" TEXT NOT NULL DEFAULT 'F-SIG-18',
    "followUpFormCode" TEXT NOT NULL DEFAULT 'F-SIG-19',
    "chairUserId" TEXT,
    "previousReviewId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_management_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_management_reviews_code_key" ON "sig_management_reviews"("code");
CREATE INDEX "sig_management_reviews_status_idx" ON "sig_management_reviews"("status");
CREATE INDEX "sig_management_reviews_meetingDate_idx" ON "sig_management_reviews"("meetingDate");
CREATE INDEX "sig_management_reviews_chairUserId_idx" ON "sig_management_reviews"("chairUserId");
CREATE INDEX "sig_management_reviews_previousReviewId_idx" ON "sig_management_reviews"("previousReviewId");

ALTER TABLE "sig_management_reviews" ADD CONSTRAINT "sig_management_reviews_chairUserId_fkey" FOREIGN KEY ("chairUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_management_reviews" ADD CONSTRAINT "sig_management_reviews_previousReviewId_fkey" FOREIGN KEY ("previousReviewId") REFERENCES "sig_management_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_management_reviews" ADD CONSTRAINT "sig_management_reviews_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sig_management_review_inputs" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "inputKey" "SigManagementReviewInputKey" NOT NULL,
    "covered" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_management_review_inputs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_management_review_inputs_reviewId_inputKey_key" ON "sig_management_review_inputs"("reviewId", "inputKey");
CREATE INDEX "sig_management_review_inputs_inputKey_idx" ON "sig_management_review_inputs"("inputKey");
ALTER TABLE "sig_management_review_inputs" ADD CONSTRAINT "sig_management_review_inputs_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "sig_management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_management_review_actions" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SigManagementReviewActionStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "efficacyNotes" TEXT,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_management_review_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sig_management_review_actions_reviewId_idx" ON "sig_management_review_actions"("reviewId");
CREATE INDEX "sig_management_review_actions_status_idx" ON "sig_management_review_actions"("status");
CREATE INDEX "sig_management_review_actions_dueDate_idx" ON "sig_management_review_actions"("dueDate");
CREATE INDEX "sig_management_review_actions_ownerUserId_idx" ON "sig_management_review_actions"("ownerUserId");
ALTER TABLE "sig_management_review_actions" ADD CONSTRAINT "sig_management_review_actions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "sig_management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_management_review_actions" ADD CONSTRAINT "sig_management_review_actions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sig_management_review_processes" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_management_review_processes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_management_review_processes_reviewId_processId_key" ON "sig_management_review_processes"("reviewId", "processId");
CREATE INDEX "sig_management_review_processes_processId_idx" ON "sig_management_review_processes"("processId");
ALTER TABLE "sig_management_review_processes" ADD CONSTRAINT "sig_management_review_processes_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "sig_management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_management_review_processes" ADD CONSTRAINT "sig_management_review_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_management_review_evidences" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_management_review_evidences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_management_review_evidences_reviewId_evidenceId_key" ON "sig_management_review_evidences"("reviewId", "evidenceId");
CREATE INDEX "sig_management_review_evidences_evidenceId_idx" ON "sig_management_review_evidences"("evidenceId");
ALTER TABLE "sig_management_review_evidences" ADD CONSTRAINT "sig_management_review_evidences_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "sig_management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_management_review_evidences" ADD CONSTRAINT "sig_management_review_evidences_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
