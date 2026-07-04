-- Renombrar pie de documento disciplinario (marca Syntra → Grupo Alfa)
UPDATE "app_disciplinary_settings"
SET "documentFooter" = 'Documento generado desde Grupo Alfa — Control de Rentabilidad.'
WHERE "documentFooter" ILIKE '%Syntra%';

ALTER TABLE "app_disciplinary_settings"
  ALTER COLUMN "documentFooter" SET DEFAULT 'Documento generado desde Grupo Alfa — Control de Rentabilidad.';
