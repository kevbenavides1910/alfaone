ALTER TABLE "patrol_devices" ADD COLUMN IF NOT EXISTS "lastGpsLatitude" DECIMAL(10,7);
ALTER TABLE "patrol_devices" ADD COLUMN IF NOT EXISTS "lastGpsLongitude" DECIMAL(10,7);
ALTER TABLE "patrol_devices" ADD COLUMN IF NOT EXISTS "lastGpsAt" TIMESTAMP(3);
