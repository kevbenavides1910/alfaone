import { PermissionLevel } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { NOTIFICATION_EVENT_CATALOG } from "@/modules/notifications/business/event-catalog";

/** Siembra tipos y reglas por rol (idempotente). */
export async function seedNotificationCatalog() {
  for (const def of NOTIFICATION_EVENT_CATALOG) {
    const type = await prisma.notificationType.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        moduleKey: def.moduleKey,
        label: def.label,
        description: def.description,
        priority: def.priority,
        icon: def.icon,
        permissionKey: def.permissionKey,
        hrefTemplate: def.hrefTemplate,
      },
      update: {
        moduleKey: def.moduleKey,
        label: def.label,
        description: def.description,
        priority: def.priority,
        icon: def.icon,
        permissionKey: def.permissionKey,
        hrefTemplate: def.hrefTemplate,
        active: true,
      },
    });

    for (const roleCode of def.roleCodes) {
      await prisma.notificationRoleRule.upsert({
        where: {
          notificationTypeId_roleCode: {
            notificationTypeId: type.id,
            roleCode,
          },
        },
        create: {
          notificationTypeId: type.id,
          roleCode,
          minLevel: PermissionLevel.VIEW,
        },
        update: {},
      });
    }
  }
}

export async function listUserPreferences(userId: string) {
  await seedNotificationCatalog();
  const types = await prisma.notificationType.findMany({
    where: { active: true },
    orderBy: [{ moduleKey: "asc" }, { label: "asc" }],
    include: {
      preferences: { where: { userId }, take: 1 },
      roleRules: true,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleEntity: { select: { code: true } } },
  });
  const roleCode = user?.roleEntity?.code ?? null;

  return types
    .filter((t) => !roleCode || t.roleRules.some((r) => r.roleCode === roleCode) || roleCode === "ADMIN")
    .map((t) => ({
      typeId: t.id,
      typeCode: t.code,
      label: t.label,
      moduleKey: t.moduleKey,
      description: t.description,
      enabled: t.preferences[0]?.enabled ?? true,
      canDisable: t.code !== "tickets.sla_warning",
    }));
}

export async function updateUserPreferences(
  userId: string,
  updates: { typeId: string; enabled: boolean }[],
) {
  for (const u of updates) {
    await prisma.notificationPreference.upsert({
      where: {
        userId_notificationTypeId: {
          userId,
          notificationTypeId: u.typeId,
        },
      },
      create: {
        userId,
        notificationTypeId: u.typeId,
        enabled: u.enabled,
      },
      update: { enabled: u.enabled },
    });
  }
}
