-- CreateTable
CREATE TABLE "hr_document_request_settings" (
    "id" TEXT NOT NULL,
    "signerName" TEXT NOT NULL DEFAULT 'LOURDES CAMBRONERO JIMENEZ',
    "signerTitle" TEXT NOT NULL DEFAULT 'DEPARTAMENTO DE RECURSOS HUMANOS',
    "companyLegalName" TEXT NOT NULL DEFAULT 'GRUPO CORPORATIVO SEGURIDAD ALFA S.A.',
    "companyIdNumber" TEXT NOT NULL DEFAULT '3-101-295842',
    "companyAddress" TEXT NOT NULL DEFAULT 'RIO SEGUNDO ALAJUELA, FRENTE HOTEL LAS PALMAS',
    "companyPhone" TEXT NOT NULL DEFAULT 'TEL: 4101-0800 EXT 120',
    "corporateGroupText" TEXT NOT NULL DEFAULT 'La compañía Consorcio Seguridad Alfa S.A., Servicios Múltiples Bena S.A., Seguridad Tango S.A., Seguridad Alfa S.A., Servicio de Monitoreo Electrónico Alfa S.A., Alfatronic S.A., Servicio Control y Vigilancia Joben S.A., Servicios Vigilancia Operativo Benlo, Bebidas del Rancho S.A., Asesoría y Capacitaciones Empresarial S.A., Alfa Secure S.A. pertenecen a Grupo Corporativo Seguridad Alfa S.A.',
    "emailFixedCc" TEXT,
    "otpSubjectTemplate" TEXT NOT NULL DEFAULT 'Código de verificación — {{tramite}}',
    "otpBodyTemplate" TEXT NOT NULL DEFAULT E'Hola,\n\nTu código de verificación para {{tramite}} es: {{codigo}}\n\nExpira en 10 minutos. Si no solicitaste este documento, ignora este mensaje.\n\nAlfa One · Recursos Humanos',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_document_request_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_document_request_sessions" (
    "id" TEXT NOT NULL,
    "cedulaNormalizada" TEXT NOT NULL,
    "tramite" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "downloadTokenHash" TEXT,
    "downloadExpiresAt" TIMESTAMP(3),
    "downloadUsedAt" TIMESTAMP(3),
    "empleoSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_document_request_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hr_document_request_sessions_cedulaNormalizada_createdAt_idx" ON "hr_document_request_sessions"("cedulaNormalizada", "createdAt");

-- CreateIndex
CREATE INDEX "hr_document_request_sessions_downloadTokenHash_idx" ON "hr_document_request_sessions"("downloadTokenHash");

-- CreateIndex
CREATE INDEX "hr_document_request_sessions_expiresAt_idx" ON "hr_document_request_sessions"("expiresAt");

-- Seed default settings row
INSERT INTO "hr_document_request_settings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
