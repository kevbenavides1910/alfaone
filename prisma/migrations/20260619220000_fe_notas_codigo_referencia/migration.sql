-- Código InformacionReferencia Hacienda (01 anula, 02 corrige texto, etc.)
ALTER TABLE "fe_notas_credito" ADD COLUMN IF NOT EXISTS "codigoReferencia" VARCHAR(2) NOT NULL DEFAULT '01';
ALTER TABLE "fe_notas_debito" ADD COLUMN IF NOT EXISTS "codigoReferencia" VARCHAR(2) NOT NULL DEFAULT '01';
