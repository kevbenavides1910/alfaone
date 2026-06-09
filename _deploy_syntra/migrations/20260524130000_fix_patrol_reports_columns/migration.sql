-- Corrige nombres de columnas (camelCase con comillas) para coincidir con Prisma.
DROP TABLE IF EXISTS "patrol_gps_tracks";
DROP TABLE IF EXISTS "patrol_marks";

CREATE TABLE "patrol_marks" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "imei" TEXT NOT NULL,
    "employeeCode" TEXT,
    "nfcTagCode" TEXT,
    "markType" TEXT NOT NULL DEFAULT 'NFC',
    "markedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "serialNumber" TEXT,
    "incorrectTime" BOOLEAN NOT NULL DEFAULT false,
    "positionCode" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patrol_marks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "patrol_marks_imei_markedAt_idx" ON "patrol_marks"("imei", "markedAt");
CREATE INDEX "patrol_marks_nfcTagCode_idx" ON "patrol_marks"("nfcTagCode");

CREATE TABLE "patrol_gps_tracks" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "imei" TEXT,
    "employeeCode" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patrol_gps_tracks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "patrol_gps_tracks_imei_recordedAt_idx" ON "patrol_gps_tracks"("imei", "recordedAt");
