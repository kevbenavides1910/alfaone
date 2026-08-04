-- Riesgos y oportunidades del SIG (ISO 9001 6.1)

CREATE TYPE "SigRiskKind" AS ENUM ('RISK', 'OPPORTUNITY');
CREATE TYPE "SigRiskStatus" AS ENUM ('IDENTIFIED', 'ANALYZED', 'TREATING', 'MONITORING', 'CLOSED');

CREATE TABLE "sig_risks" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "SigRiskKind" NOT NULL DEFAULT 'RISK',
    "status" "SigRiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "processId" TEXT,
    "ownerUserId" TEXT,
    "likelihood" INTEGER NOT NULL DEFAULT 3,
    "impact" INTEGER NOT NULL DEFAULT 3,
    "inherentScore" INTEGER NOT NULL DEFAULT 9,
    "residualLikelihood" INTEGER,
    "residualImpact" INTEGER,
    "residualScore" INTEGER,
    "treatment" TEXT,
    "reviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_risks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_risks_code_key" ON "sig_risks"("code");
CREATE INDEX "sig_risks_processId_idx" ON "sig_risks"("processId");
CREATE INDEX "sig_risks_status_idx" ON "sig_risks"("status");
CREATE INDEX "sig_risks_kind_idx" ON "sig_risks"("kind");
CREATE INDEX "sig_risks_inherentScore_idx" ON "sig_risks"("inherentScore");
CREATE INDEX "sig_risks_residualScore_idx" ON "sig_risks"("residualScore");
CREATE INDEX "sig_risks_ownerUserId_idx" ON "sig_risks"("ownerUserId");
CREATE INDEX "sig_risks_nextReviewDate_idx" ON "sig_risks"("nextReviewDate");

ALTER TABLE "sig_risks" ADD CONSTRAINT "sig_risks_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_risks" ADD CONSTRAINT "sig_risks_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_risks" ADD CONSTRAINT "sig_risks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sig_risk_processes" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_risk_processes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_risk_processes_riskId_processId_key" ON "sig_risk_processes"("riskId", "processId");
CREATE INDEX "sig_risk_processes_processId_idx" ON "sig_risk_processes"("processId");
ALTER TABLE "sig_risk_processes" ADD CONSTRAINT "sig_risk_processes_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "sig_risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_risk_processes" ADD CONSTRAINT "sig_risk_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_risk_controls" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_risk_controls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_risk_controls_riskId_controlId_key" ON "sig_risk_controls"("riskId", "controlId");
CREATE INDEX "sig_risk_controls_controlId_idx" ON "sig_risk_controls"("controlId");
ALTER TABLE "sig_risk_controls" ADD CONSTRAINT "sig_risk_controls_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "sig_risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_risk_controls" ADD CONSTRAINT "sig_risk_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "sig_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_risk_requirements" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_risk_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_risk_requirements_riskId_requirementId_key" ON "sig_risk_requirements"("riskId", "requirementId");
CREATE INDEX "sig_risk_requirements_requirementId_idx" ON "sig_risk_requirements"("requirementId");
ALTER TABLE "sig_risk_requirements" ADD CONSTRAINT "sig_risk_requirements_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "sig_risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_risk_requirements" ADD CONSTRAINT "sig_risk_requirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "sig_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_risk_evidences" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_risk_evidences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_risk_evidences_riskId_evidenceId_key" ON "sig_risk_evidences"("riskId", "evidenceId");
CREATE INDEX "sig_risk_evidences_evidenceId_idx" ON "sig_risk_evidences"("evidenceId");
ALTER TABLE "sig_risk_evidences" ADD CONSTRAINT "sig_risk_evidences_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "sig_risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_risk_evidences" ADD CONSTRAINT "sig_risk_evidences_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
