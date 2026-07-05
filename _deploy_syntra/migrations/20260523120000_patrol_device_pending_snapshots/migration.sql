CREATE TABLE IF NOT EXISTS "patrol_device_pending_snapshots" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT,
  "imei" TEXT NOT NULL,
  "employeeCode" TEXT,
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "staleCount" INTEGER NOT NULL DEFAULT 0,
  "appVersion" TEXT,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_device_pending_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patrol_device_pending_snapshots_imei_createdAt_idx"
  ON "patrol_device_pending_snapshots"("imei", "createdAt");
