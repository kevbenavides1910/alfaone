import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { unauthorized, forbidden } from "./response";
import { NextRequest } from "next/server";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";
import type { Session } from "next-auth";
import type { PermissionKey, PermissionLevelId } from "@/lib/permissions/registry";
import {
  canManageCatalogsSession,
  canManageDisciplinarySettingsSession,
  canManageExpenses,
  canManageInventarioSession,
  canModifyContracts,
  isAdmin,
} from "@/modules/core/permissions";

export {
  canModifyContracts,
  canManageExpenses,
  isAdmin,
  canManageInventarioSession,
  canManageCatalogsSession,
  canManageDisciplinarySettingsSession,
};

type Handler<T = unknown> = (
  req: NextRequest,
  context: { session: Awaited<ReturnType<typeof getServerSession>>; params?: T }
) => Promise<Response>;

export function withAuth<T = unknown>(
  handler: Handler<T>,
  options: { permission?: PermissionKey; minLevel?: PermissionLevelId } = {}
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
    }

    return handler(req, { session, params: ctx?.params });
  };
}

export { withPermission, withPlatformAdmin } from "@/lib/permissions/middleware";

export async function getSession() {
  return getServerSession(authOptions);
}

export function requirePermission(
  session: Session | null | undefined,
  key: PermissionKey,
  minLevel: PermissionLevelId = "view",
): boolean {
  return hasPermission(session ?? null, key, minLevel);
}
