import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { unauthorized, forbidden } from "@/lib/api/response";
import { hasPermission, isPlatformAdmin } from "./check";
import type { PermissionKey, PermissionLevelId } from "./registry";
import { getEffectiveSession } from "@/lib/impersonation/server";

type RouteContext<T = Record<string, string>> = {
  params: Promise<T>;
};

type Handler<T = Record<string, string>> = (
  req: NextRequest,
  context: RouteContext<T>
) => Promise<Response>;

/** Wrapper para rutas que exigen un permiso del registro. */
export function withPermission<T extends Record<string, string> = Record<string, string>>(
  handler: (
    req: NextRequest,
    context: {
      session: Session;
      params: T;
    }
  ) => Promise<Response>,
  permissionKey: PermissionKey,
  minLevel: PermissionLevelId = "view"
) {
  return async (req: NextRequest, ctx: RouteContext<T>) => {
    const token = req.headers.get("x-impersonation-token");
    const session = await getEffectiveSession(token);
    if (!session?.user) return unauthorized();
    if (!hasPermission(session, permissionKey, minLevel)) {
      return forbidden();
    }
    const params = (await ctx.params) as T;
    return handler(req, { session, params });
  };
}

/** Solo administradores de plataforma (rol ADMIN o plataforma.roles admin). */
export function withPlatformAdmin<T extends Record<string, string> = Record<string, string>>(
  handler: (
    req: NextRequest,
    context: {
      session: Session;
      params: T;
    }
  ) => Promise<Response>
) {
  return async (req: NextRequest, ctx?: RouteContext<T>) => {
    const token = req.headers.get("x-impersonation-token");
    const session = await getEffectiveSession(token);
    if (!session?.user) return unauthorized();
    if (!isPlatformAdmin(session)) return forbidden();
    const params = ctx ? ((await ctx.params) as T) : ({} as T);
    return handler(req, { session, params });
  };
}
