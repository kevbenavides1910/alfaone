-- SIG MVP: requisitos, evidencias, muestreo y endurecimiento NC

-- CreateEnum
CREATE TYPE "FindingType" AS ENUM ('NONCONFORMITY', 'OBSERVATION', 'OPPORTUNITY');
CREATE TYPE "ActionPlanEfficacyStatus" AS ENUM ('PENDING', 'VERIFIED', 'NOT_EFFECTIVE');
CREATE TYPE "AuditSampleMethod" AS ENUM ('RANDOM', 'RISK_BASED', 'AUDITOR_JUDGMENT', 'MIXED');
CREATE TYPE "SigEvidenceType" AS ENUM ('PHOTO', 'PDF', 'EXCEL', 'RECORD', 'EMAIL', 'ACTA', 'CERTIFICATE', 'INTERVIEW', 'SCREENSHOT', 'VIDEO', 'FORM', 'INSPECTION', 'OTHER');
CREATE TYPE "SigEvidenceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUPERSEDED');
CREATE TYPE "SigEvidenceLinkRole" AS ENUM ('OBSERVED', 'IMPLEMENTATION', 'EFFICACY');

-- Standards
CREATE TABLE "sig_standards" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_standards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_standards_code_key" ON "sig_standards"("code");

-- Requirements
CREATE TABLE "sig_requirements" (
    "id" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "isApplicable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_requirements_standardId_code_key" ON "sig_requirements"("standardId", "code");
CREATE INDEX "sig_requirements_parentId_idx" ON "sig_requirements"("parentId");
CREATE INDEX "sig_requirements_isApplicable_idx" ON "sig_requirements"("isApplicable");
ALTER TABLE "sig_requirements" ADD CONSTRAINT "sig_requirements_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES "sig_standards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sig_requirements" ADD CONSTRAINT "sig_requirements_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "sig_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_requirements" ADD CONSTRAINT "sig_requirements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "sig_requirement_processes" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_requirement_processes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_requirement_processes_requirementId_processId_key" ON "sig_requirement_processes"("requirementId", "processId");
CREATE INDEX "sig_requirement_processes_processId_idx" ON "sig_requirement_processes"("processId");
ALTER TABLE "sig_requirement_processes" ADD CONSTRAINT "sig_requirement_processes_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "sig_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_requirement_processes" ADD CONSTRAINT "sig_requirement_processes_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_requirement_documents" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_requirement_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_requirement_documents_requirementId_documentId_key" ON "sig_requirement_documents"("requirementId", "documentId");
CREATE INDEX "sig_requirement_documents_documentId_idx" ON "sig_requirement_documents"("documentId");
ALTER TABLE "sig_requirement_documents" ADD CONSTRAINT "sig_requirement_documents_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "sig_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_requirement_documents" ADD CONSTRAINT "sig_requirement_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "sig_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Evidences
CREATE TABLE "sig_evidences" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SigEvidenceType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "evidenceDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" "SigEvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
    "processId" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "storagePath" TEXT,
    "fileSizeBytes" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_evidences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_evidences_code_key" ON "sig_evidences"("code");
CREATE INDEX "sig_evidences_processId_idx" ON "sig_evidences"("processId");
CREATE INDEX "sig_evidences_status_idx" ON "sig_evidences"("status");
CREATE INDEX "sig_evidences_evidenceDate_idx" ON "sig_evidences"("evidenceDate");
CREATE INDEX "sig_evidences_validUntil_idx" ON "sig_evidences"("validUntil");
ALTER TABLE "sig_evidences" ADD CONSTRAINT "sig_evidences_processId_fkey" FOREIGN KEY ("processId") REFERENCES "sig_processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_evidences" ADD CONSTRAINT "sig_evidences_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sig_evidence_requirements" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_evidence_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_evidence_requirements_evidenceId_requirementId_key" ON "sig_evidence_requirements"("evidenceId", "requirementId");
CREATE INDEX "sig_evidence_requirements_requirementId_idx" ON "sig_evidence_requirements"("requirementId");
ALTER TABLE "sig_evidence_requirements" ADD CONSTRAINT "sig_evidence_requirements_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_evidence_requirements" ADD CONSTRAINT "sig_evidence_requirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "sig_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_evidence_audits" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_evidence_audits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_evidence_audits_evidenceId_auditId_key" ON "sig_evidence_audits"("evidenceId", "auditId");
CREATE INDEX "sig_evidence_audits_auditId_idx" ON "sig_evidence_audits"("auditId");
ALTER TABLE "sig_evidence_audits" ADD CONSTRAINT "sig_evidence_audits_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_evidence_audits" ADD CONSTRAINT "sig_evidence_audits_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "sig_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_evidence_checklist_items" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_evidence_checklist_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_evidence_checklist_items_evidenceId_checklistItemId_key" ON "sig_evidence_checklist_items"("evidenceId", "checklistItemId");
CREATE INDEX "sig_evidence_checklist_items_checklistItemId_idx" ON "sig_evidence_checklist_items"("checklistItemId");
ALTER TABLE "sig_evidence_checklist_items" ADD CONSTRAINT "sig_evidence_checklist_items_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_evidence_checklist_items" ADD CONSTRAINT "sig_evidence_checklist_items_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "sig_audit_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_evidence_findings" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_evidence_findings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_evidence_findings_evidenceId_findingId_key" ON "sig_evidence_findings"("evidenceId", "findingId");
CREATE INDEX "sig_evidence_findings_findingId_idx" ON "sig_evidence_findings"("findingId");
ALTER TABLE "sig_evidence_findings" ADD CONSTRAINT "sig_evidence_findings_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_evidence_findings" ADD CONSTRAINT "sig_evidence_findings_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "sig_audit_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_evidence_action_plans" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "actionPlanId" TEXT NOT NULL,
    "role" "SigEvidenceLinkRole" NOT NULL DEFAULT 'IMPLEMENTATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_evidence_action_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_evidence_action_plans_evidenceId_actionPlanId_role_key" ON "sig_evidence_action_plans"("evidenceId", "actionPlanId", "role");
CREATE INDEX "sig_evidence_action_plans_actionPlanId_idx" ON "sig_evidence_action_plans"("actionPlanId");
ALTER TABLE "sig_evidence_action_plans" ADD CONSTRAINT "sig_evidence_action_plans_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "sig_evidences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_evidence_action_plans" ADD CONSTRAINT "sig_evidence_action_plans_actionPlanId_fkey" FOREIGN KEY ("actionPlanId") REFERENCES "sig_action_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_finding_requirements" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_finding_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sig_finding_requirements_findingId_requirementId_key" ON "sig_finding_requirements"("findingId", "requirementId");
CREATE INDEX "sig_finding_requirements_requirementId_idx" ON "sig_finding_requirements"("requirementId");
ALTER TABLE "sig_finding_requirements" ADD CONSTRAINT "sig_finding_requirements_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "sig_audit_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sig_finding_requirements" ADD CONSTRAINT "sig_finding_requirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "sig_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Samples
CREATE TABLE "sig_audit_samples" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "populationDescription" TEXT NOT NULL,
    "populationSize" INTEGER,
    "sampleSize" INTEGER,
    "method" "AuditSampleMethod" NOT NULL DEFAULT 'AUDITOR_JUDGMENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sig_audit_samples_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sig_audit_samples_auditId_idx" ON "sig_audit_samples"("auditId");
ALTER TABLE "sig_audit_samples" ADD CONSTRAINT "sig_audit_samples_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "sig_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sig_audit_sample_items" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "code" TEXT,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sig_audit_sample_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sig_audit_sample_items_sampleId_idx" ON "sig_audit_sample_items"("sampleId");
ALTER TABLE "sig_audit_sample_items" ADD CONSTRAINT "sig_audit_sample_items_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "sig_audit_samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Harden checklist
ALTER TABLE "sig_audit_checklist_items" ADD COLUMN "requirementId" TEXT;
CREATE INDEX "sig_audit_checklist_items_requirementId_idx" ON "sig_audit_checklist_items"("requirementId");
ALTER TABLE "sig_audit_checklist_items" ADD CONSTRAINT "sig_audit_checklist_items_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "sig_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Harden findings
ALTER TABLE "sig_audit_findings" ADD COLUMN "findingType" "FindingType" NOT NULL DEFAULT 'NONCONFORMITY';
ALTER TABLE "sig_audit_findings" ADD COLUMN "criterionText" TEXT;
ALTER TABLE "sig_audit_findings" ADD COLUMN "evidenceStatement" TEXT;
ALTER TABLE "sig_audit_findings" ADD COLUMN "nonconformityStatement" TEXT;
ALTER TABLE "sig_audit_findings" ADD COLUMN "rootCause" TEXT;
ALTER TABLE "sig_audit_findings" ADD COLUMN "checklistItemId" TEXT;
CREATE INDEX "sig_audit_findings_findingType_idx" ON "sig_audit_findings"("findingType");
CREATE INDEX "sig_audit_findings_checklistItemId_idx" ON "sig_audit_findings"("checklistItemId");
ALTER TABLE "sig_audit_findings" ADD CONSTRAINT "sig_audit_findings_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "sig_audit_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Harden action plans
ALTER TABLE "sig_action_plans" ADD COLUMN "correctionImmediate" TEXT;
ALTER TABLE "sig_action_plans" ADD COLUMN "responsibleUserId" TEXT;
ALTER TABLE "sig_action_plans" ADD COLUMN "efficacyStatus" "ActionPlanEfficacyStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "sig_action_plans" ADD COLUMN "efficacyVerifiedAt" TIMESTAMP(3);
ALTER TABLE "sig_action_plans" ADD COLUMN "efficacyVerifiedById" TEXT;
ALTER TABLE "sig_action_plans" ADD COLUMN "efficacyNotes" TEXT;
CREATE INDEX "sig_action_plans_responsibleUserId_idx" ON "sig_action_plans"("responsibleUserId");
CREATE INDEX "sig_action_plans_efficacyStatus_idx" ON "sig_action_plans"("efficacyStatus");
ALTER TABLE "sig_action_plans" ADD CONSTRAINT "sig_action_plans_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sig_action_plans" ADD CONSTRAINT "sig_action_plans_efficacyVerifiedById_fkey" FOREIGN KEY ("efficacyVerifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed standards
INSERT INTO "sig_standards" ("id", "code", "name", "year", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
('sigstd_iso9001', 'ISO_9001', 'ISO 9001:2015 — Sistema de gestión de la calidad', 2015, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigstd_iso18788', 'ISO_18788', 'ISO 18788:2018 — Gestión de operaciones de seguridad privada', 2018, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigstd_internal', 'INTERNAL', 'Requisitos internos del SIG ALFA', NULL, true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed ISO 9001 clauses (high-level, Manual-aligned; exclusions marked)
INSERT INTO "sig_requirements" ("id", "standardId", "code", "title", "description", "parentId", "isApplicable", "sortOrder", "createdAt", "updatedAt") VALUES
('sigreq_9001_4', 'sigstd_iso9001', '4', 'Contexto de la organización', NULL, NULL, true, 400, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_4_1', 'sigstd_iso9001', '4.1', 'Comprensión de la organización y de su contexto', NULL, 'sigreq_9001_4', true, 410, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_4_2', 'sigstd_iso9001', '4.2', 'Comprensión de las necesidades y expectativas de las partes interesadas', NULL, 'sigreq_9001_4', true, 420, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_4_3', 'sigstd_iso9001', '4.3', 'Determinación del alcance del sistema de gestión de la calidad', NULL, 'sigreq_9001_4', true, 430, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_4_4', 'sigstd_iso9001', '4.4', 'Sistema de gestión de la calidad y sus procesos', NULL, 'sigreq_9001_4', true, 440, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_5', 'sigstd_iso9001', '5', 'Liderazgo', NULL, NULL, true, 500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_5_1', 'sigstd_iso9001', '5.1', 'Liderazgo y compromiso', NULL, 'sigreq_9001_5', true, 510, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_5_2', 'sigstd_iso9001', '5.2', 'Política', NULL, 'sigreq_9001_5', true, 520, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_5_3', 'sigstd_iso9001', '5.3', 'Roles, responsabilidades y autoridades', NULL, 'sigreq_9001_5', true, 530, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_6', 'sigstd_iso9001', '6', 'Planificación', NULL, NULL, true, 600, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_6_1', 'sigstd_iso9001', '6.1', 'Acciones para abordar riesgos y oportunidades', NULL, 'sigreq_9001_6', true, 610, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_6_2', 'sigstd_iso9001', '6.2', 'Objetivos de la calidad y planificación', NULL, 'sigreq_9001_6', true, 620, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_6_3', 'sigstd_iso9001', '6.3', 'Planificación de los cambios', NULL, 'sigreq_9001_6', true, 630, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_7', 'sigstd_iso9001', '7', 'Apoyo', NULL, NULL, true, 700, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_7_1', 'sigstd_iso9001', '7.1', 'Recursos', NULL, 'sigreq_9001_7', true, 710, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_7_1_5_2', 'sigstd_iso9001', '7.1.5.2', 'Trazabilidad de las mediciones', 'Excluido del alcance del SIG ALFA (Manual M-SIG-01)', 'sigreq_9001_7_1', false, 715, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_7_2', 'sigstd_iso9001', '7.2', 'Competencia', NULL, 'sigreq_9001_7', true, 720, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_7_3', 'sigstd_iso9001', '7.3', 'Toma de conciencia', NULL, 'sigreq_9001_7', true, 730, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_7_4', 'sigstd_iso9001', '7.4', 'Comunicación', NULL, 'sigreq_9001_7', true, 740, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_7_5', 'sigstd_iso9001', '7.5', 'Información documentada', NULL, 'sigreq_9001_7', true, 750, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_8', 'sigstd_iso9001', '8', 'Operación', NULL, NULL, true, 800, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_8_1', 'sigstd_iso9001', '8.1', 'Planificación y control operacional', NULL, 'sigreq_9001_8', true, 810, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_8_2', 'sigstd_iso9001', '8.2', 'Requisitos para los productos y servicios', NULL, 'sigreq_9001_8', true, 820, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_8_3', 'sigstd_iso9001', '8.3', 'Diseño y desarrollo', 'Excluido del alcance del SIG ALFA (Manual M-SIG-01)', 'sigreq_9001_8', false, 830, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_8_4', 'sigstd_iso9001', '8.4', 'Control de los procesos, productos y servicios suministrados externamente', NULL, 'sigreq_9001_8', true, 840, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_8_5', 'sigstd_iso9001', '8.5', 'Producción y prestación del servicio', NULL, 'sigreq_9001_8', true, 850, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_8_6', 'sigstd_iso9001', '8.6', 'Liberación de los productos y servicios', NULL, 'sigreq_9001_8', true, 860, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_8_7', 'sigstd_iso9001', '8.7', 'Control de las salidas no conformes', NULL, 'sigreq_9001_8', true, 870, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_9', 'sigstd_iso9001', '9', 'Evaluación del desempeño', NULL, NULL, true, 900, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_9_1', 'sigstd_iso9001', '9.1', 'Seguimiento, medición, análisis y evaluación', NULL, 'sigreq_9001_9', true, 910, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_9_2', 'sigstd_iso9001', '9.2', 'Auditoría interna', NULL, 'sigreq_9001_9', true, 920, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_9_3', 'sigstd_iso9001', '9.3', 'Revisión por la dirección', NULL, 'sigreq_9001_9', true, 930, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_10', 'sigstd_iso9001', '10', 'Mejora', NULL, NULL, true, 1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_10_1', 'sigstd_iso9001', '10.1', 'Generalidades', NULL, 'sigreq_9001_10', true, 1010, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_10_2', 'sigstd_iso9001', '10.2', 'No conformidad y acción correctiva', NULL, 'sigreq_9001_10', true, 1020, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_9001_10_3', 'sigstd_iso9001', '10.3', 'Mejora continua', NULL, 'sigreq_9001_10', true, 1030, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed ISO 18788 clauses (high-level; exclusions marked per Manual)
INSERT INTO "sig_requirements" ("id", "standardId", "code", "title", "description", "parentId", "isApplicable", "sortOrder", "createdAt", "updatedAt") VALUES
('sigreq_18788_4', 'sigstd_iso18788', '4', 'Contexto de la organización', NULL, NULL, true, 400, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_4_1', 'sigstd_iso18788', '4.1', 'Comprensión de la organización y de su contexto', NULL, 'sigreq_18788_4', true, 410, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_4_2', 'sigstd_iso18788', '4.2', 'Comprensión de las necesidades y expectativas de las partes interesadas', NULL, 'sigreq_18788_4', true, 420, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_4_3', 'sigstd_iso18788', '4.3', 'Determinación del alcance', NULL, 'sigreq_18788_4', true, 430, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_4_4', 'sigstd_iso18788', '4.4', 'Sistema de gestión de operaciones de seguridad', NULL, 'sigreq_18788_4', true, 440, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_5', 'sigstd_iso18788', '5', 'Liderazgo', NULL, NULL, true, 500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_5_1', 'sigstd_iso18788', '5.1', 'Liderazgo y compromiso', NULL, 'sigreq_18788_5', true, 510, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_5_2', 'sigstd_iso18788', '5.2', 'Política', NULL, 'sigreq_18788_5', true, 520, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_5_3', 'sigstd_iso18788', '5.3', 'Roles, responsabilidades y autoridades', NULL, 'sigreq_18788_5', true, 530, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_6', 'sigstd_iso18788', '6', 'Planificación', NULL, NULL, true, 600, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_6_1', 'sigstd_iso18788', '6.1', 'Acciones para abordar riesgos y oportunidades', NULL, 'sigreq_18788_6', true, 610, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_6_1_2', 'sigstd_iso18788', '6.1.2', 'Requisitos legales y otros requisitos', NULL, 'sigreq_18788_6_1', true, 612, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_6_2', 'sigstd_iso18788', '6.2', 'Objetivos y planificación', NULL, 'sigreq_18788_6', true, 620, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_7', 'sigstd_iso18788', '7', 'Apoyo', NULL, NULL, true, 700, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_7_1', 'sigstd_iso18788', '7.1', 'Recursos', NULL, 'sigreq_18788_7', true, 710, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_7_1_2_4', 'sigstd_iso18788', '7.1.2.4', 'Externalización y subcontratación', 'Excluido del alcance del SIG ALFA (Manual M-SIG-01)', 'sigreq_18788_7_1', false, 714, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_7_2', 'sigstd_iso18788', '7.2', 'Competencia', NULL, 'sigreq_18788_7', true, 720, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_7_3', 'sigstd_iso18788', '7.3', 'Toma de conciencia', NULL, 'sigreq_18788_7', true, 730, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_7_4', 'sigstd_iso18788', '7.4', 'Comunicación', NULL, 'sigreq_18788_7', true, 740, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_7_5', 'sigstd_iso18788', '7.5', 'Información documentada', NULL, 'sigreq_18788_7', true, 750, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8', 'sigstd_iso18788', '8', 'Operación', NULL, NULL, true, 800, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8_1', 'sigstd_iso18788', '8.1', 'Planificación y control operacional', NULL, 'sigreq_18788_8', true, 810, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8_1_3', 'sigstd_iso18788', '8.1.3', 'Respeto de los derechos humanos', NULL, 'sigreq_18788_8_1', true, 813, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8_3', 'sigstd_iso18788', '8.3', 'Uso de la fuerza', NULL, 'sigreq_18788_8', true, 830, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8_4', 'sigstd_iso18788', '8.4', 'Aprehensión y revisión', 'Excluido del alcance del SIG ALFA (Manual M-SIG-01)', 'sigreq_18788_8', false, 840, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8_5', 'sigstd_iso18788', '8.5', 'Producción y prestación del servicio', NULL, 'sigreq_18788_8', true, 850, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8_5_2', 'sigstd_iso18788', '8.5.2', 'Operaciones de detención', 'Excluido del alcance del SIG ALFA (Manual M-SIG-01)', 'sigreq_18788_8_5', false, 852, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8_7', 'sigstd_iso18788', '8.7', 'Control del servicio no conforme', NULL, 'sigreq_18788_8', true, 870, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_8_8', 'sigstd_iso18788', '8.8', 'Gestión de incidentes', NULL, 'sigreq_18788_8', true, 880, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_9', 'sigstd_iso18788', '9', 'Evaluación del desempeño', NULL, NULL, true, 900, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_9_1', 'sigstd_iso18788', '9.1', 'Seguimiento, medición, análisis y evaluación', NULL, 'sigreq_18788_9', true, 910, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_9_1_3', 'sigstd_iso18788', '9.1.3', 'Ejercicios y pruebas', NULL, 'sigreq_18788_9_1', true, 913, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_9_2', 'sigstd_iso18788', '9.2', 'Auditoría interna', NULL, 'sigreq_18788_9', true, 920, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_9_3', 'sigstd_iso18788', '9.3', 'Revisión por la dirección', NULL, 'sigreq_18788_9', true, 930, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_10', 'sigstd_iso18788', '10', 'Mejora', NULL, NULL, true, 1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('sigreq_18788_10_2', 'sigstd_iso18788', '10.2', 'No conformidad y acción correctiva', NULL, 'sigreq_18788_10', true, 1020, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
