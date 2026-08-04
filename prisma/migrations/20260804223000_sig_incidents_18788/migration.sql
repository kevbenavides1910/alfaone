-- Incidentes / eventos de seguridad y DDHH (ISO 18788)

CREATE TYPE "SigIncidentType" AS ENUM ('SECURITY_EVENT', 'USE_OF_FORCE', 'HUMAN_RIGHTS', 'COMPLAINT', 'NEAR_MISS', 'OTHER');
CREATE TYPE "SigIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "SigIncidentStatus" AS ENUM ('REPORTED', 'UNDER_INVESTIGATION', 'ACTIONS_PENDING', 'CLOSED', 'DISMISSED');

CREATE TABLE "sig_incidents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "SigIncidentType" NOT NULL DEFAULT 'SECURITY_EVENT',
    "severity" "SigIncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "SigIncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "processId" TEXT,
    "ownerUserId" TEXT,
    "involvedParties" TEXT,
    "immediateActions" TEXT,
    "rootCause" TEXT,
    "correctiveActions" TEXT,
    "humanRightsImpact" BOOLEAN NOT NULL DEFAULT false,
    "notificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closureNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_incidents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sig_incidents_code_key" ON "sig_incidents"("code");
CREATE INDEX "sig_incidents_processId_idx" ON "sig_incidents"("processId");
CREATE INDEX "sig_incidents_status_idx" ON "sig_incidents"("status");
CREATE INDEX "sig_incidents_type_idx" ON "sig_incidents"("type");
CREATE INDEX "sig_incidents_severity_idx" ON "sig_incidents"("severity");
CREATE INDEX "sig_incidents_occurredAt_idx" ON "sig_incidents"("occurredAt");
CREATE INDEX "sig_incidents_ownerUserId_idx" ON "sig_incidents"("ownerUserId");
CREATE INDEX "sig_incidents_humanRightsImpact_idx" ON "sig_incidents"("humanRightsImpact");

ALTER TABLE "sig_incidents" ADD CONSTRAINT "sig_incidents_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_incidents" ADD CONSTRAINT "sig_incidents_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_incidents" ADD CONSTRAINT "sig_incidents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sig_incident_processes" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_incident_processes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_incident_processes_incidentId_processId_key" ON "sig_incident_processes"("incidentId", "processId");
CREATE INDEX "sig_incident_processes_processId_idx" ON "sig_incident_processes"("processId");
ALTER TABLE "sig_incident_processes" ADD CONSTRAINT "sig_incident_processes_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "sig_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_incident_processes" ADD CONSTRAINT "sig_incident_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_incident_controls" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_incident_controls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_incident_controls_incidentId_controlId_key" ON "sig_incident_controls"("incidentId", "controlId");
CREATE INDEX "sig_incident_controls_controlId_idx" ON "sig_incident_controls"("controlId");
ALTER TABLE "sig_incident_controls" ADD CONSTRAINT "sig_incident_controls_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "sig_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_incident_controls" ADD CONSTRAINT "sig_incident_controls_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "sig_controls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_incident_evidences" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_incident_evidences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_incident_evidences_incidentId_evidenceId_key" ON "sig_incident_evidences"("incidentId", "evidenceId");
CREATE INDEX "sig_incident_evidences_evidenceId_idx" ON "sig_incident_evidences"("evidenceId");
ALTER TABLE "sig_incident_evidences" ADD CONSTRAINT "sig_incident_evidences_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "sig_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_incident_evidences" ADD CONSTRAINT "sig_incident_evidences_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
