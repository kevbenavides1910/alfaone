ALTER TABLE "app_finger_settings" ADD COLUMN IF NOT EXISTS "attSmbUser" TEXT;
ALTER TABLE "app_finger_settings" ADD COLUMN IF NOT EXISTS "attSmbPasswordEnc" TEXT;
