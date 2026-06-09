ALTER TABLE "patrol_devices" ADD COLUMN IF NOT EXISTS "positionId" TEXT;
ALTER TABLE "patrol_devices" ADD COLUMN IF NOT EXISTS "assetId" TEXT;
ALTER TABLE "patrol_devices" ADD COLUMN IF NOT EXISTS "locationDesc" TEXT;

CREATE INDEX IF NOT EXISTS "patrol_devices_positionId_idx" ON "patrol_devices"("positionId");
CREATE INDEX IF NOT EXISTS "patrol_devices_assetId_idx" ON "patrol_devices"("assetId");
