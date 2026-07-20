import type { PermissionLevel } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { permissionLevelFromDb } from "./levels";
import type { PermissionLevelId } from "./registry";

export type PermissionMap = Record<string, PermissionLevelId>;

export function buildPermissionMap(
  rows: { permissionKey: string; level: PermissionLevel }[]
): PermissionMap {
  // Solo niveles ≠ none: la cookie JWT de ADMIN no cabe si se serializan
  // todas las claves en "none". hasPermission usa `perms[key] ?? "none"`.
  const map: PermissionMap = {};
  for (const row of rows) {
    if (row.level !== "NONE") {
      map[row.permissionKey] = permissionLevelFromDb(row.level);
    }
  }
  return map;
}

export async function getRolePermissions(roleId: string): Promise<PermissionMap> {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId, level: { not: "NONE" } },
    select: { permissionKey: true, level: true },
  });
  return buildPermissionMap(rows);
}

export async function getUserPermissionContext(userId: string): Promise<{
  roleId: string | null;
  roleCode: string;
  permissions: PermissionMap;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roleId: true,
      role: true,
      roleEntity: {
        select: {
          id: true,
          code: true,
          permissions: { select: { permissionKey: true, level: true } },
        },
      },
    },
  });
  if (!user) return null;

  if (user.roleEntity) {
    return {
      roleId: user.roleEntity.id,
      roleCode: user.roleEntity.code,
      permissions: buildPermissionMap(user.roleEntity.permissions),
    };
  }

  const fallback = await prisma.role.findUnique({
    where: { code: user.role },
    include: { permissions: { select: { permissionKey: true, level: true } } },
  });
  if (fallback) {
    return {
      roleId: fallback.id,
      roleCode: fallback.code,
      permissions: buildPermissionMap(fallback.permissions),
    };
  }

  return {
    roleId: null,
    roleCode: user.role,
    permissions: {},
  };
}
