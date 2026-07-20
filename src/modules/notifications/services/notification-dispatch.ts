import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { levelMeets, type PermissionKey } from "@/lib/permissions/registry";
import type { PermissionMap } from "@/lib/permissions/resolve";
import type { NotificationEventPayload } from "@/modules/notifications/business/types";
import { writeNotificationAudit } from "@/modules/notifications/services/notification-audit";

function buildHref(
  template: string | null | undefined,
  entityId: string | null | undefined,
  explicitHref: string | null | undefined,
): string | null {
  if (explicitHref?.trim()) return explicitHref.trim();
  if (!template || !entityId) return null;
  return template.replace("{entityId}", encodeURIComponent(entityId));
}

async function isUserPreferenceEnabled(
  userId: string,
  typeId: string,
): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: {
      userId_notificationTypeId: { userId, notificationTypeId: typeId },
    },
  });
  return pref?.enabled ?? true;
}

async function userHasPermissionForType(
  userId: string,
  permissionKey: string | null | undefined,
): Promise<boolean> {
  if (!permissionKey) return true;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleEntity: { include: { permissions: true } },
    },
  });
  if (!user) return false;
  if (user.roleEntity?.code === "ADMIN" || user.role === "ADMIN") return true;

  const perms: PermissionMap = {};
  for (const p of user.roleEntity?.permissions ?? []) {
    perms[p.permissionKey as PermissionKey] = p.level.toLowerCase() as PermissionMap[string];
  }
  const level = perms[permissionKey as PermissionKey] ?? "none";
  return levelMeets(level, "view");
}

async function roleAllowsType(
  roleCode: string | null | undefined,
  typeId: string,
): Promise<boolean> {
  if (!roleCode) return false;
  if (roleCode === "ADMIN") return true;
  const rule = await prisma.notificationRoleRule.findFirst({
    where: { notificationTypeId: typeId, roleCode },
  });
  return Boolean(rule);
}

/**
 * Punto de entrada EDA: los módulos emiten eventos; el centro decide destinatarios.
 */
export async function dispatchNotificationEvent(
  payload: NotificationEventPayload,
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const db = tx ?? prisma;

  const type = await db.notificationType.findUnique({
    where: { code: payload.typeCode, active: true },
  });
  if (!type) return 0;

  const href = buildHref(type.hrefTemplate, payload.entityId, payload.href);
  const priority = payload.priority ?? type.priority;

  const explicit = [...new Set((payload.recipientUserIds ?? []).filter(Boolean))];
  const explicitSet = new Set(explicit);
  const recipients = new Set<string>(explicit);

  if (recipients.size === 0) {
    const rules = await db.notificationRoleRule.findMany({
      where: { notificationTypeId: type.id },
      select: { roleCode: true },
    });
    const roleCodes = rules.map((r) => r.roleCode);
    if (roleCodes.length > 0) {
      const users = await db.user.findMany({
        where: {
          isActive: true,
          OR: [
            { roleEntity: { code: { in: roleCodes } } },
            ...roleCodes.includes("ADMIN")
              ? [{ role: "ADMIN" as const }]
              : [],
          ],
        },
        select: {
          id: true,
          roleEntity: { select: { code: true } },
        },
      });
      for (const u of users) {
        const code = u.roleEntity?.code ?? null;
        if (await roleAllowsType(code, type.id)) {
          recipients.add(u.id);
        }
      }
    }
  }

  if (payload.actorUserId) {
    recipients.delete(payload.actorUserId);
  }

  let created = 0;
  for (const userId of recipients) {
    const [prefOk, permOk, roleOk] = await Promise.all([
      isUserPreferenceEnabled(userId, type.id),
      userHasPermissionForType(userId, type.permissionKey),
      explicitSet.has(userId)
        ? Promise.resolve(true)
        : (async () => {
            const u = await db.user.findUnique({
              where: { id: userId },
              select: { roleEntity: { select: { code: true } } },
            });
            return roleAllowsType(u?.roleEntity?.code, type.id);
          })(),
    ]);
    if (!prefOk || !permOk || !roleOk) continue;

    const row = await db.appNotification.create({
      data: {
        userId,
        typeId: type.id,
        title: payload.title,
        body: payload.body,
        moduleKey: payload.moduleKey || type.moduleKey,
        entityType: payload.entityType,
        entityId: payload.entityId,
        href,
        priority,
        actorUserId: payload.actorUserId,
        actorIp: payload.actorIp,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    await writeNotificationAudit(
      {
        notificationId: row.id,
        action: "created",
        userId: payload.actorUserId,
        recipientId: userId,
        moduleKey: row.moduleKey,
        actorIp: payload.actorIp,
      },
      db,
    );
    emitNotificationRealtime({ userId, notificationId: row.id });
    created += 1;
  }

  return created;
}

/** Preparado para broadcasting en tiempo real (Reverb/SSE). */
export type NotificationRealtimePayload = {
  userId: string;
  notificationId: string;
};

const realtimeListeners = new Set<(p: NotificationRealtimePayload) => void>();

export function onNotificationCreated(
  listener: (p: NotificationRealtimePayload) => void,
): () => void {
  realtimeListeners.add(listener);
  return () => realtimeListeners.delete(listener);
}

export function emitNotificationRealtime(p: NotificationRealtimePayload) {
  for (const fn of realtimeListeners) {
    try {
      fn(p);
    } catch {
      /* noop — no bloquear dispatch */
    }
  }
}
