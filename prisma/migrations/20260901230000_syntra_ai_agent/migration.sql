ALTER TABLE "syntra_ai_settings"
  ADD COLUMN IF NOT EXISTS "agentEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "agentMaxRounds" INTEGER NOT NULL DEFAULT 6;

UPDATE "syntra_ai_settings"
SET
  "agentEnabled" = COALESCE("agentEnabled", true),
  "agentMaxRounds" = COALESCE("agentMaxRounds", 6)
WHERE id = 'default';
