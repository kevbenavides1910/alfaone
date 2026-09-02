-- Biométrico ZK: origen de marcas, vínculo empleado-reloj y campos de push.
CREATE TYPE "FingerPunchSource" AS ENUM ('DEVICE', 'ATT2016');

ALTER TABLE "finger_punches"
  ADD COLUMN IF NOT EXISTS "deviceId" TEXT,
  ADD COLUMN IF NOT EXISTS "source" "FingerPunchSource" NOT NULL DEFAULT 'ATT2016';

ALTER TABLE "finger_employee_links"
  ADD COLUMN IF NOT EXISTS "privilege" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pin" TEXT,
  ADD COLUMN IF NOT EXISTS "card" TEXT,
  ADD COLUMN IF NOT EXISTS "lastPushAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastPushError" TEXT;

CREATE TABLE IF NOT EXISTS "finger_employee_devices" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finger_employee_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finger_employee_devices_employeeId_deviceId_key"
  ON "finger_employee_devices"("employeeId", "deviceId");

CREATE INDEX IF NOT EXISTS "finger_employee_devices_deviceId_idx"
  ON "finger_employee_devices"("deviceId");

CREATE INDEX IF NOT EXISTS "finger_punches_deviceId_idx" ON "finger_punches"("deviceId");
CREATE INDEX IF NOT EXISTS "finger_punches_source_idx" ON "finger_punches"("source");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finger_punches_deviceId_fkey'
  ) THEN
    ALTER TABLE "finger_punches"
      ADD CONSTRAINT "finger_punches_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "finger_devices"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finger_employee_devices_employeeId_fkey'
  ) THEN
    ALTER TABLE "finger_employee_devices"
      ADD CONSTRAINT "finger_employee_devices_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finger_employee_devices_deviceId_fkey'
  ) THEN
    ALTER TABLE "finger_employee_devices"
      ADD CONSTRAINT "finger_employee_devices_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "finger_devices"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
