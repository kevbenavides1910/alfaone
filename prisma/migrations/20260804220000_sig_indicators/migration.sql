-- Indicadores / KPI del SIG (ISO 9001 9.1)

CREATE TYPE "SigIndicatorDirection" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');
CREATE TYPE "SigIndicatorFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'ADHOC');
CREATE TYPE "SigIndicatorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNDER_REVIEW');

CREATE TABLE "sig_indicators" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "processId" TEXT,
    "ownerUserId" TEXT,
    "unit" TEXT,
    "direction" "SigIndicatorDirection" NOT NULL DEFAULT 'HIGHER_BETTER',
    "frequency" "SigIndicatorFrequency" NOT NULL DEFAULT 'MONTHLY',
    "targetValue" DECIMAL(15,4),
    "warningThreshold" DECIMAL(15,4),
    "criticalThreshold" DECIMAL(15,4),
    "status" "SigIndicatorStatus" NOT NULL DEFAULT 'ACTIVE',
    "formulaNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_indicators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_indicators_code_key" ON "sig_indicators"("code");
CREATE INDEX "sig_indicators_processId_idx" ON "sig_indicators"("processId");
CREATE INDEX "sig_indicators_status_idx" ON "sig_indicators"("status");
CREATE INDEX "sig_indicators_frequency_idx" ON "sig_indicators"("frequency");
CREATE INDEX "sig_indicators_ownerUserId_idx" ON "sig_indicators"("ownerUserId");

ALTER TABLE "sig_indicators" ADD CONSTRAINT "sig_indicators_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_indicators" ADD CONSTRAINT "sig_indicators_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_indicators" ADD CONSTRAINT "sig_indicators_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sig_indicator_processes" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_indicator_processes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_indicator_processes_indicatorId_processId_key" ON "sig_indicator_processes"("indicatorId", "processId");
CREATE INDEX "sig_indicator_processes_processId_idx" ON "sig_indicator_processes"("processId");
ALTER TABLE "sig_indicator_processes" ADD CONSTRAINT "sig_indicator_processes_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "sig_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_indicator_processes" ADD CONSTRAINT "sig_indicator_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_indicator_measurements" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3),
    "value" DECIMAL(15,4) NOT NULL,
    "notes" TEXT,
    "evidenceId" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_indicator_measurements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sig_indicator_measurements_indicatorId_periodStart_idx" ON "sig_indicator_measurements"("indicatorId", "periodStart");
CREATE INDEX "sig_indicator_measurements_evidenceId_idx" ON "sig_indicator_measurements"("evidenceId");
CREATE INDEX "sig_indicator_measurements_recordedById_idx" ON "sig_indicator_measurements"("recordedById");

ALTER TABLE "sig_indicator_measurements" ADD CONSTRAINT "sig_indicator_measurements_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "sig_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_indicator_measurements" ADD CONSTRAINT "sig_indicator_measurements_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_indicator_measurements" ADD CONSTRAINT "sig_indicator_measurements_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
