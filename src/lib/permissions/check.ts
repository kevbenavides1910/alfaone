import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";
import {
  levelMeets,
  type PermissionKey,
  type PermissionLevelId,
  permissionKeysForModuleGroup,
  HOME_MODULE_PERMISSION_GROUPS,
  getPermissionDef,
} from "./registry";
import type { PermissionMap } from "./resolve";
import type { AppModuleId } from "@/lib/modules/types";

export type SessionWithPermissions = Session & {
  user: Session["user"] & {
    roleId?: string | null;
    roleCode?: string;
    permissions?: PermissionMap;
    impersonatedRoleId?: string | null;
    impersonatedRoleCode?: string | null;
  };
};

function isAdminRole(session: Session | null): boolean {
  const s = session as SessionWithPermissions | null;
  return s?.user?.roleCode === "ADMIN" || s?.user?.role === "ADMIN";
}

export function getSessionPermissions(session: Session | null): PermissionMap {
  const s = session as SessionWithPermissions | null;
  return s?.user?.permissions ?? {};
}

export function hasPermission(
  session: Session | null,
  key: PermissionKey,
  minLevel: PermissionLevelId = "view"
): boolean {
  if (isAdminRole(session)) return true;
  const perms = getSessionPermissions(session);
  const actual = perms[key] ?? "none";
  return levelMeets(actual, minLevel);
}

/** ADMIN legacy: rol código ADMIN tiene acceso total. */
export function isPlatformAdmin(session: Session | null): boolean {
  if (isAdminRole(session)) return true;
  return hasPermission(session, "plataforma.roles", "admin");
}

export function canAccessHomeTile(
  session: Session | null,
  tileId: string
): boolean {
  if (isAdminRole(session)) return true;

  const group = HOME_MODULE_PERMISSION_GROUPS.find((g) => g.tileId === tileId);
  if (!group) return false;
  if (tileId === "mantenimiento" && !isPlatformAdmin(session)) {
    const keys = permissionKeysForModuleGroup(group.moduleKeys);
    return keys.some((k) => hasPermission(session, k, "view"));
  }
  const keys = permissionKeysForModuleGroup(group.moduleKeys);
  return keys.some((k) => hasPermission(session, k, "view"));
}

export function canAccessModuleFromSession(
  session: Session | null,
  moduleId: AppModuleId
): boolean {
  if (isPlatformAdmin(session)) return true;
  const perms = getSessionPermissions(session);
  for (const [key, level] of Object.entries(perms)) {
    if (level === "none") continue;
    const def = getPermissionDef(key as PermissionKey);
    if (def?.module.moduleId === moduleId && levelMeets(level, "view")) {
      return true;
    }
  }
  return false;
}

/** Compatibilidad con enum UserRole en sesión. */
export function sessionRole(session: Session | null): UserRole {
  const s = session as SessionWithPermissions | null;
  const code = s?.user?.roleCode ?? s?.user?.role;
  if (code && ["ADMIN", "SUPERVISOR", "COMPRAS", "COMMERCIAL", "CONSULTA"].includes(code)) {
    return code as UserRole;
  }
  return (s?.user?.role as UserRole) ?? "CONSULTA";
}
