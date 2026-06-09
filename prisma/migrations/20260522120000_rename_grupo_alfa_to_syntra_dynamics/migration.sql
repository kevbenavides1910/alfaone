-- Renombrar pie de documento disciplinario (marca Grupo Alfa → Syntra Dynamics)
UPDATE "app_disciplinary_settings"
SET "documentFooter" = 'Documento generado desde Syntra Dynamics — Control de Rentabilidad.'
WHERE "documentFooter" ILIKE '%Grupo Alfa%';

ALTER TABLE "app_disciplinary_settings"
  ALTER COLUMN "documentFooter" SET DEFAULT 'Documento generado desde Syntra Dynamics — Control de Rentabilidad.';
