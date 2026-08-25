ALTER TABLE "app_finger_settings" ADD COLUMN IF NOT EXISTS "attWindowsPath" TEXT;
ALTER TABLE "app_finger_settings" ADD COLUMN IF NOT EXISTS "attAccessUser" TEXT DEFAULT 'Admin';
ALTER TABLE "app_finger_settings" ADD COLUMN IF NOT EXISTS "attBlankPassword" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_finger_settings" ADD COLUMN IF NOT EXISTS "attDriveMappings" JSONB;
