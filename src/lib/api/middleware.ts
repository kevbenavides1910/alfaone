import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { UserRole } from "@prisma/client";
import { unauthorized, forbidden } from "./response";
import { NextRequest } from "next/server";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";
import type { Session } from "next-auth";
import type { PermissionKey, PermissionLevelId } from "@/lib/permissions/registry";

function isSessionLike(v: unknown): v is Session {
  return typeof v === "object" && v !== null && "user" in v;
}

export function requirePermission(
  session: Session | null | undefined,
  key: PermissionKey,
  level: PermissionLevelId = "view"
): boolean {
  return hasPermission(session ?? null, key, level);
}

export {
  canViewContractTab,
  canEditContractTab,
  canAdminContractTab,
  canViewContractPositions,
} from "@/lib/permissions/contract-tabs";

export function canModifyContracts(
  roleOrSession: UserRole | Session | null | undefined
): boolean {
  if (!roleOrSession) return false;
  if (isSessionLike(roleOrSession)) {
    return hasPermission(roleOrSession, "presupuestos.contracts", "edit");
  }
  const role = roleOrSession as UserRole;
  return role === "ADMIN" || role === "SUPERVISOR" || role === "COMMERCIAL";
}

export function canManageExpenses(
  roleOrSession: UserRole | Session | null | undefined
): boolean {
  if (!roleOrSession) return false;
  if (isSessionLike(roleOrSession)) {
    return hasPermission(roleOrSession, "gastos.expenses", "edit");
  }
  const role = roleOrSession as UserRole;
  return role === "ADMIN" || role === "SUPERVISOR" || role === "COMPRAS";
}

export function isAdmin(roleOrSession: UserRole | Session | null | undefined): boolean {
  if (!roleOrSession) return false;
  if (isSessionLike(roleOrSession)) {
    return isPlatformAdmin(roleOrSession);
  }
  return roleOrSession === "ADMIN";
}

type Handler<T = unknown> = (
  req: NextRequest,
  context: { session: Awaited<ReturnType<typeof getServerSession>>; params?: T }
) => Promise<Response>;

export function withAuth<T = unknown>(
  handler: Handler<T>,
  options: { roles?: UserRole[]; permission?: PermissionKey; minLevel?: PermissionLevelId } = {}
) {
  return async (req: NextRequest, ctx?: { params?: T }) => {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return unauthorized();
    }

    if (options.permission) {
      if (!hasPermission(session, options.permission, options.minLevel ?? "view")) {
        return forbidden();
      }
    } else if (options.roles && !options.roles.includes(session.user.role)) {
      if (!isPlatformAdmin(session)) {
        return forbidden();
      }
    }

    return handler(req, { session, params: ctx?.params });
  };
}

export { withPermission, withPlatformAdmin } from "@/lib/permissions/middleware";

export async function getSession() {
  const { getEffectiveSession } = await import("@/lib/impersonation/server");
  return getEffectiveSession();
}
