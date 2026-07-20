import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import type { PermissionMap } from "@/lib/permissions/resolve";

const LEGACY_ROLES = ["ADMIN", "SUPERVISOR", "COMPRAS", "COMMERCIAL", "CONSULTA"] as const;

export function legacyRoleFromCode(code: string): UserRole {
  if (LEGACY_ROLES.includes(code as (typeof LEGACY_ROLES)[number])) {
    return code as UserRole;
  }
  return "CONSULTA";
}

/** Aplica rol impersonado sobre la sesión NextAuth (UI y APIs). */
export function mergeImpersonationIntoSession(
  session: Session,
  role: { id: string; code: string },
  permissions: PermissionMap
): Session {
  return {
    ...session,
    user: {
      ...session.user,
      roleId: role.id,
      roleCode: role.code,
      role: legacyRoleFromCode(role.code),
      permissions,
      impersonatedRoleId: role.id,
      impersonatedRoleCode: role.code,
    },
  };
}
