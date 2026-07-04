CREATE TABLE IF NOT EXISTS "patrol_bitacora_entries" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT,
  "imei" TEXT NOT NULL,
  "employeeCode" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "routeCode" TEXT,
  "incidentAt" TIMESTAMP(3) NOT NULL,
  "imageMimeType" TEXT,
  "imageFileName" TEXT,
  "imagePath" TEXT,
  "source" TEXT NOT NULL DEFAULT 'APP',
  "linkedOmissionKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_bitacora_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patrol_bitacora_entries_imei_idx" ON "patrol_bitacora_entries"("imei");
CREATE INDEX IF NOT EXISTS "patrol_bitacora_entries_incidentAt_idx" ON "patrol_bitacora_entries"("incidentAt");
CREATE INDEX IF NOT EXISTS "patrol_bitacora_entries_linkedOmissionKey_idx" ON "patrol_bitacora_entries"("linkedOmissionKey");

CREATE TABLE IF NOT EXISTS "patrol_omission_justifications" (
  "id" TEXT NOT NULL,
  "omissionKey" TEXT NOT NULL,
  "fecha" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "routePointId" TEXT NOT NULL,
  "routeCode" TEXT NOT NULL,
  "pointLabel" TEXT NOT NULL,
  "nfcTagCode" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "imageMimeType" TEXT,
  "imageFileName" TEXT,
  "imagePath" TEXT,
  "source" TEXT NOT NULL DEFAULT 'WEB',
  "bitacoraEntryId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patrol_omission_justifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patrol_omission_justifications_omissionKey_key"
  ON "patrol_omission_justifications"("omissionKey");
CREATE UNIQUE INDEX IF NOT EXISTS "patrol_omission_justifications_bitacoraEntryId_key"
  ON "patrol_omission_justifications"("bitacoraEntryId");
CREATE INDEX IF NOT EXISTS "patrol_omission_justifications_fecha_idx" ON "patrol_omission_justifications"("fecha");
CREATE INDEX IF NOT EXISTS "patrol_omission_justifications_deviceId_idx" ON "patrol_omission_justifications"("deviceId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patrol_omission_justifications_bitacoraEntryId_fkey') THEN
    ALTER TABLE "patrol_omission_justifications"
      ADD CONSTRAINT "patrol_omission_justifications_bitacoraEntryId_fkey"
      FOREIGN KEY ("bitacoraEntryId") REFERENCES "patrol_bitacora_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
