ALTER TABLE "syntra_ai_settings"
  ADD COLUMN IF NOT EXISTS "modelVision" TEXT NOT NULL DEFAULT 'mimo-v2.5',
  ADD COLUMN IF NOT EXISTS "routeVisionAuto" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "modelDocuments" TEXT;

UPDATE "syntra_ai_settings"
SET
  "modelVision" = COALESCE("modelVision", 'mimo-v2.5'),
  "routeVisionAuto" = COALESCE("routeVisionAuto", true)
WHERE id = 'default';
