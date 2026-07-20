import { prisma } from "@/modules/core/db/prisma";
import { INBOX_RETENTION_DAYS } from "@/modules/notifications/business/types";

/** Mueve notificaciones visibles > 3 días al historial (no elimina). */
export async function archiveStaleInboxNotifications(): Promise<{
  archived: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INBOX_RETENTION_DAYS);

  const stale = await prisma.appNotification.findMany({
    where: {
      inboxVisible: true,
      status: { in: ["UNREAD", "READ"] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      userId: true,
      title: true,
      body: true,
      moduleKey: true,
      entityType: true,
      entityId: true,
      href: true,
      priority: true,
      status: true,
      readAt: true,
      createdAt: true,
      archivedAt: true,
      type: { select: { code: true, label: true } },
    },
  });

  if (!stale.length) return { archived: 0 };

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const row of stale) {
      await tx.appNotification.update({
        where: { id: row.id },
        data: {
          inboxVisible: false,
          status: "ARCHIVED",
          archivedAt: now,
        },
      });
      await tx.notificationHistory.upsert({
        where: { notificationId: row.id },
        create: {
          notificationId: row.id,
          userId: row.userId,
          snapshot: {
            title: row.title,
            body: row.body,
            moduleKey: row.moduleKey,
            entityType: row.entityType,
            entityId: row.entityId,
            href: row.href,
            priority: row.priority,
            status: row.status,
            readAt: row.readAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            typeCode: row.type.code,
            typeLabel: row.type.label,
          },
        },
        update: { movedAt: now },
      });
      await tx.notificationAuditLog.create({
        data: {
          notificationId: row.id,
          action: "auto_archived",
          recipientId: row.userId,
          moduleKey: row.moduleKey,
        },
      });
    }
  });

  return { archived: stale.length };
}
