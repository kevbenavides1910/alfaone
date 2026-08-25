ALTER TABLE "app_finger_settings" ADD COLUMN IF NOT EXISTS "lastAutoSyncAt" TIMESTAMP(3);
ALTER TABLE "app_finger_settings" ADD COLUMN IF NOT EXISTS "syncRunningAt" TIMESTAMP(3);
