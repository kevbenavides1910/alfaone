-- Fase D v4.4: otros cargos detallados
ALTER TABLE "fe_facturas" ADD COLUMN IF NOT EXISTS "otrosCargos" JSONB;
