-- SYNTRA: dispositivos, rutas de recorrido y campos de patrulla en puestos.

ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "nfcTagCode" TEXT;
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);

CREATE UNIQUE INDEX IF NOT EXISTS "positions_nfcTagCode_key" ON "positions"("nfcTagCode");

CREATE TABLE IF NOT EXISTS "app_syntra_settings" (
    "id" TEXT NOT NULL,
    "enableGeofences" BOOLEAN NOT NULL DEFAULT false,
    "enableGpsTrack" BOOLEAN NOT NULL DEFAULT false,
    "geofenceRadiusM" INTEGER NOT NULL DEFAULT 100,
    "routesSyncMinutes" INTEGER NOT NULL DEFAULT 360,
    "reportsSyncMinutes" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_syntra_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "patrol_devices" (
    "id" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "patrol_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "patrol_routes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contractId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "patrol_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "patrol_route_points" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nfcTagCode" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "radiusM" INTEGER NOT NULL DEFAULT 100,
    "windowStart" TEXT,
    "windowEnd" TEXT,
    "positionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "patrol_route_points_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "patrol_assignments" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "patrol_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "patrol_devices_imei_key" ON "patrol_devices"("imei");
CREATE INDEX IF NOT EXISTS "patrol_devices_employeeCode_idx" ON "patrol_devices"("employeeCode");
CREATE UNIQUE INDEX IF NOT EXISTS "patrol_routes_code_key" ON "patrol_routes"("code");
CREATE INDEX IF NOT EXISTS "patrol_route_points_routeId_idx" ON "patrol_route_points"("routeId");
CREATE INDEX IF NOT EXISTS "patrol_route_points_nfcTagCode_idx" ON "patrol_route_points"("nfcTagCode");
CREATE UNIQUE INDEX IF NOT EXISTS "patrol_assignments_deviceId_routeId_validFrom_key" ON "patrol_assignments"("deviceId", "routeId", "validFrom");
CREATE INDEX IF NOT EXISTS "patrol_assignments_deviceId_idx" ON "patrol_assignments"("deviceId");
CREATE INDEX IF NOT EXISTS "patrol_assignments_routeId_idx" ON "patrol_assignments"("routeId");

ALTER TABLE "patrol_routes" DROP CONSTRAINT IF EXISTS "patrol_routes_contractId_fkey";
ALTER TABLE "patrol_routes" ADD CONSTRAINT "patrol_routes_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patrol_route_points" DROP CONSTRAINT IF EXISTS "patrol_route_points_routeId_fkey";
ALTER TABLE "patrol_route_points" ADD CONSTRAINT "patrol_route_points_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "patrol_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patrol_route_points" DROP CONSTRAINT IF EXISTS "patrol_route_points_positionId_fkey";
ALTER TABLE "patrol_route_points" ADD CONSTRAINT "patrol_route_points_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "patrol_assignments" DROP CONSTRAINT IF EXISTS "patrol_assignments_deviceId_fkey";
ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "patrol_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patrol_assignments" DROP CONSTRAINT IF EXISTS "patrol_assignments_routeId_fkey";
ALTER TABLE "patrol_assignments" ADD CONSTRAINT "patrol_assignments_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "patrol_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "app_syntra_settings" ("id", "enableGeofences", "enableGpsTrack", "geofenceRadiusM", "routesSyncMinutes", "reportsSyncMinutes", "updatedAt")
VALUES ('default', false, false, 100, 360, 30, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
