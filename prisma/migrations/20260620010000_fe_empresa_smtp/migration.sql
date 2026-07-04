-- SMTP por empresa emisora FE (configuración en UI)
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "correoCopiaFija" TEXT;
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "mailProvider" VARCHAR(20) NOT NULL DEFAULT 'CUSTOM_SMTP';
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "smtpHost" TEXT;
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER;
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN;
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "smtpUser" TEXT;
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "smtpPass" TEXT;
ALTER TABLE "fe_empresas" ADD COLUMN IF NOT EXISTS "smtpFrom" TEXT;
