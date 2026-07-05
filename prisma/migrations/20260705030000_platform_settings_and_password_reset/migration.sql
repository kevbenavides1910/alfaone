-- Add password reset fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetToken"     TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3);

-- Create platform settings table (single row: id = 'default')
CREATE TABLE IF NOT EXISTS "app_platform_settings" (
    "id"                TEXT         NOT NULL DEFAULT 'default',
    "notificationEmail" TEXT,
    "smtpHost"          TEXT,
    "smtpPort"          INTEGER,
    "smtpSecure"        BOOLEAN,
    "smtpUser"          TEXT,
    "smtpPass"          TEXT,
    "smtpFrom"          TEXT,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_platform_settings_pkey" PRIMARY KEY ("id")
);
