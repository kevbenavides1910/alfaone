-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "notification_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'INFO',
    "icon" TEXT,
    "permissionKey" TEXT,
    "hrefTemplate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_role_rules" (
    "id" TEXT NOT NULL,
    "notificationTypeId" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "minLevel" "PermissionLevel" NOT NULL DEFAULT 'VIEW',

    CONSTRAINT "notification_role_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "href" TEXT,
    "priority" "NotificationPriority" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "inboxVisible" BOOLEAN NOT NULL DEFAULT true,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "actorUserId" TEXT,
    "actorIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_history" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationTypeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_audit_logs" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "recipientId" TEXT,
    "moduleKey" TEXT,
    "actorIp" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_types_code_key" ON "notification_types"("code");

-- CreateIndex
CREATE INDEX "notification_types_moduleKey_idx" ON "notification_types"("moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "notification_role_rules_notificationTypeId_roleCode_key" ON "notification_role_rules"("notificationTypeId", "roleCode");

-- CreateIndex
CREATE INDEX "notification_role_rules_roleCode_idx" ON "notification_role_rules"("roleCode");

-- CreateIndex
CREATE INDEX "app_notifications_userId_inboxVisible_status_createdAt_idx" ON "app_notifications"("userId", "inboxVisible", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "app_notifications_userId_status_idx" ON "app_notifications"("userId", "status");

-- CreateIndex
CREATE INDEX "app_notifications_createdAt_idx" ON "app_notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_history_notificationId_key" ON "notification_history"("notificationId");

-- CreateIndex
CREATE INDEX "notification_history_userId_movedAt_idx" ON "notification_history"("userId", "movedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_notificationTypeId_key" ON "notification_preferences"("userId", "notificationTypeId");

-- CreateIndex
CREATE INDEX "notification_audit_logs_notificationId_idx" ON "notification_audit_logs"("notificationId");

-- CreateIndex
CREATE INDEX "notification_audit_logs_userId_createdAt_idx" ON "notification_audit_logs"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "notification_role_rules" ADD CONSTRAINT "notification_role_rules_notificationTypeId_fkey" FOREIGN KEY ("notificationTypeId") REFERENCES "notification_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "notification_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_notificationTypeId_fkey" FOREIGN KEY ("notificationTypeId") REFERENCES "notification_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_audit_logs" ADD CONSTRAINT "notification_audit_logs_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "app_notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
