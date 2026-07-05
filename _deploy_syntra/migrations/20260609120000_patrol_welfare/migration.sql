ALTER TABLE "patrol_routes"
  ADD COLUMN IF NOT EXISTS "welfareEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "patrol_routes"
  ADD COLUMN IF NOT EXISTS "welfareIntervalMinutes" INTEGER NOT NULL DEFAULT 60;

CREATE TABLE IF NOT EXISTS "patrol_welfare_checks" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "deviceId" TEXT,
  "imei" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "triggeredAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "ackLatitude" DECIMAL(10, 7),
  "ackLongitude" DECIMAL(10, 7),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_welfare_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patrol_welfare_checks_routeId_idx"
  ON "patrol_welfare_checks"("routeId");

CREATE INDEX IF NOT EXISTS "patrol_welfare_checks_imei_status_idx"
  ON "patrol_welfare_checks"("imei", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patrol_welfare_checks_routeId_fkey') THEN
    ALTER TABLE "patrol_welfare_checks"
      ADD CONSTRAINT "patrol_welfare_checks_routeId_fkey"
      FOREIGN KEY ("routeId") REFERENCES "patrol_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
