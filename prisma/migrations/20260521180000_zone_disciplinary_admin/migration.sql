-- Campos de administrador disciplinario por zona (Disciplinario / importación de marcas).
ALTER TABLE "zones" ADD COLUMN IF NOT EXISTS "disciplinaryAdministrator" TEXT;
ALTER TABLE "zones" ADD COLUMN IF NOT EXISTS "disciplinaryAdministratorEmail" TEXT;
