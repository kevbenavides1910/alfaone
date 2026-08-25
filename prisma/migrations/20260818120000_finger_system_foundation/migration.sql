-- CreateEnum
CREATE TYPE "FingerDeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FingerSyncDirection" AS ENUM ('PULL', 'PUSH', 'BOTH');

-- CreateEnum
CREATE TYPE "FingerSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "app_finger_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "attReadOnly" BOOLEAN NOT NULL DEFAULT true,
    "attConnectionType" TEXT,
    "attSmbShare" TEXT,
    "attDatabaseName" TEXT,
    "syncAutoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "discoveryDefaultPort" INTEGER NOT NULL DEFAULT 4370,
    "backupPath" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_finger_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finger_devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "brand" TEXT DEFAULT 'ZKTeco',
    "model" TEXT,
    "serialNumber" TEXT,
    "company" TEXT,
    "location" TEXT,
    "description" TEXT,
    "status" "FingerDeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastOnlineAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "fingerprintCount" INTEGER NOT NULL DEFAULT 0,
    "punchCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finger_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finger_employee_links" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attUserId" INTEGER,
    "badgeNumber" TEXT,
    "company" TEXT,
    "fingerprintCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finger_employee_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finger_sync_logs" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "direction" "FingerSyncDirection" NOT NULL,
    "status" "FingerSyncStatus" NOT NULL DEFAULT 'PENDING',
    "operation" TEXT NOT NULL,
    "message" TEXT,
    "detailJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "triggeredById" TEXT,

    CONSTRAINT "finger_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finger_operation_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'success',
    "message" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finger_operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finger_employee_links_employeeId_key" ON "finger_employee_links"("employeeId");

-- CreateIndex
CREATE INDEX "finger_devices_company_idx" ON "finger_devices"("company");

-- CreateIndex
CREATE INDEX "finger_devices_ipAddress_idx" ON "finger_devices"("ipAddress");

-- CreateIndex
CREATE INDEX "finger_devices_isActive_idx" ON "finger_devices"("isActive");

-- CreateIndex
CREATE INDEX "finger_employee_links_badgeNumber_idx" ON "finger_employee_links"("badgeNumber");

-- CreateIndex
CREATE INDEX "finger_employee_links_attUserId_idx" ON "finger_employee_links"("attUserId");

-- CreateIndex
CREATE INDEX "finger_employee_links_company_idx" ON "finger_employee_links"("company");

-- CreateIndex
CREATE INDEX "finger_sync_logs_startedAt_idx" ON "finger_sync_logs"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "finger_sync_logs_deviceId_idx" ON "finger_sync_logs"("deviceId");

-- CreateIndex
CREATE INDEX "finger_operation_logs_createdAt_idx" ON "finger_operation_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "finger_operation_logs_userId_idx" ON "finger_operation_logs"("userId");

-- CreateIndex
CREATE INDEX "finger_operation_logs_action_idx" ON "finger_operation_logs"("action");

-- AddForeignKey
ALTER TABLE "finger_devices" ADD CONSTRAINT "finger_devices_company_fkey" FOREIGN KEY ("company") REFERENCES "companies"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finger_employee_links" ADD CONSTRAINT "finger_employee_links_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finger_employee_links" ADD CONSTRAINT "finger_employee_links_company_fkey" FOREIGN KEY ("company") REFERENCES "companies"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finger_sync_logs" ADD CONSTRAINT "finger_sync_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "finger_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finger_sync_logs" ADD CONSTRAINT "finger_sync_logs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finger_operation_logs" ADD CONSTRAINT "finger_operation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default settings row
INSERT INTO "app_finger_settings" ("id", "attReadOnly", "attSmbShare", "attDatabaseName", "updatedAt")
VALUES ('default', true, '//10.1.1.3/DB-Biometrico', 'ATT2016.MDB', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
