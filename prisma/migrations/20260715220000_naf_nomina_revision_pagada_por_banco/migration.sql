-- Pagado por canal de banco (CK / Davivienda / BN) en revisión de planilla.
ALTER TABLE "naf_nomina_revision_checklist"
  ADD COLUMN IF NOT EXISTS "pagadaCk" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pagadaDav" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pagadaBn" BOOLEAN NOT NULL DEFAULT false;

-- Conservar marcas previas del check general Pagada.
UPDATE "naf_nomina_revision_checklist"
SET
  "pagadaCk" = true,
  "pagadaDav" = true,
  "pagadaBn" = true
WHERE "pagada" = true;
