import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type {
  NotificationHistoryItem,
  NotificationListItem,
} from "@/modules/notifications/business/types";
import { MODULE_LABELS } from "@/modules/notifications/business/types";
import { writeNotificationAudit } from "@/modules/notifications/services/notification-audit";

function mapRow(row: {
  id: string;
  title: string;
  body: string;
  moduleKey: string;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  priority: NotificationListItem["priority"];
  status: NotificationListItem["status"];
  readAt: Date | null;
  createdAt: Date;
  type: { code: string; label: string; icon: string | null };
}): NotificationListItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    moduleKey: row.moduleKey,
    moduleLabel: MODULE_LABELS[row.moduleKey] ?? row.moduleKey,
    typeCode: row.type.code,
    typeLabel: row.type.label,
    entityType: row.entityType,
    entityId: row.entityId,
    href: row.href,
    priority: row.priority,
    status: row.status,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    icon: row.type.icon,
  };
}

const listInclude = {
  type: { select: { code: true, label: true, icon: true } },
} as const;

export async function listInboxNotifications(
  userId: string,
  limit = 40,
): Promise<NotificationListItem[]> {
  const rows = await prisma.appNotification.findMany({
    where: {
      userId,
      inboxVisible: true,
      status: { in: ["UNREAD", "READ"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: listInclude,
  });
  return rows.map(mapRow);
}

export async function countUnreadInbox(userId: string): Promise<number> {
  return prisma.appNotification.count({
    where: {
      userId,
      inboxVisible: true,
      status: "UNREAD",
    },
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
  actorIp?: string | null,
) {
  const now = new Date();
  const updated = await prisma.appNotification.updateMany({
    where: {
      id: notificationId,
      userId,
      status: { in: ["UNREAD", "READ"] },
    },
    data: { status: "READ", readAt: now },
  });
  if (updated.count > 0) {
    await writeNotificationAudit({
      notificationId,
      action: "read",
      userId,
      recipientId: userId,
      actorIp,
    });
  }
}

export async function markAllNotificationsRead(
  userId: string,
  actorIp?: string | null,
) {
  const now = new Date();
  const rows = await prisma.appNotification.findMany({
    where: { userId, inboxVisible: true, status: "UNREAD" },
    select: { id: true },
  });
  if (!rows.length) return;
  await prisma.appNotification.updateMany({
    where: { userId, inboxVisible: true, status: "UNREAD" },
    data: { status: "READ", readAt: now },
  });
  await prisma.notificationAuditLog.createMany({
    data: rows.map((r) => ({
      notificationId: r.id,
      action: "read",
      userId,
      recipientId: userId,
      actorIp,
    })),
  });
}

export async function archiveNotification(
  userId: string,
  notificationId: string,
  actorIp?: string | null,
) {
  const now = new Date();
  await prisma.appNotification.updateMany({
    where: { id: notificationId, userId },
    data: {
      status: "ARCHIVED",
      archivedAt: now,
      inboxVisible: false,
    },
  });
  await writeNotificationAudit({
    notificationId,
    action: "archived",
    userId,
    recipientId: userId,
    actorIp,
  });
}

export async function deleteNotification(
  userId: string,
  notificationId: string,
  actorIp?: string | null,
) {
  const now = new Date();
  await prisma.appNotification.updateMany({
    where: { id: notificationId, userId },
    data: {
      status: "DELETED",
      deletedAt: now,
      inboxVisible: false,
    },
  });
  await writeNotificationAudit({
    notificationId,
    action: "deleted",
    userId,
    recipientId: userId,
    actorIp,
  });
}

export async function bulkUpdateNotifications(
  userId: string,
  ids: string[],
  action: "read" | "archive" | "delete",
  actorIp?: string | null,
) {
  for (const id of ids) {
    if (action === "read") await markNotificationRead(userId, id, actorIp);
    else if (action === "archive") await archiveNotification(userId, id, actorIp);
    else await deleteNotification(userId, id, actorIp);
  }
}

export async function restoreFromHistory(
  userId: string,
  notificationId: string,
  actorIp?: string | null,
) {
  const hist = await prisma.notificationHistory.findFirst({
    where: { notificationId, userId },
  });
  if (!hist) return false;

  await prisma.appNotification.updateMany({
    where: { id: notificationId, userId },
    data: {
      status: "READ",
      inboxVisible: true,
      archivedAt: null,
      deletedAt: null,
    },
  });
  await writeNotificationAudit({
    notificationId,
    action: "restored",
    userId,
    recipientId: userId,
    actorIp,
  });
  return true;
}

export type HistoryFilters = {
  q?: string;
  moduleKey?: string;
  priority?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export async function listNotificationHistory(
  userId: string,
  filters: HistoryFilters = {},
): Promise<{ items: NotificationHistoryItem[]; total: number }> {
  const limit = Math.min(100, Math.max(10, filters.limit ?? 50));
  const offset = Math.max(0, filters.offset ?? 0);

  const where: Prisma.AppNotificationWhereInput = {
    userId,
    NOT: { status: "DELETED" },
    AND: [
      {
        OR: [{ inboxVisible: false }, { status: "ARCHIVED" }],
      },
    ],
  };

  if (filters.moduleKey) where.moduleKey = filters.moduleKey;
  if (filters.priority) where.priority = filters.priority as NotificationListItem["priority"];
  if (filters.status) where.status = filters.status as NotificationListItem["status"];
  if (filters.q?.trim()) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { title: { contains: filters.q.trim(), mode: "insensitive" } },
          { body: { contains: filters.q.trim(), mode: "insensitive" } },
        ],
      },
    ];
  }
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = new Date(filters.from);
    if (filters.to) where.createdAt.lte = new Date(filters.to);
  }

  const [rows, total] = await Promise.all([
    prisma.appNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: listInclude,
    }),
    prisma.appNotification.count({ where }),
  ]);

  const historyRows = await prisma.notificationHistory.findMany({
    where: { notificationId: { in: rows.map((r) => r.id) } },
  });
  const movedMap = new Map(historyRows.map((h) => [h.notificationId, h.movedAt]));

  return {
    total,
    items: rows.map((r) => ({
      ...mapRow(r),
      movedAt: (movedMap.get(r.id) ?? r.archivedAt ?? r.createdAt).toISOString(),
      archivedAt: r.archivedAt?.toISOString() ?? null,
    })),
  };
}
