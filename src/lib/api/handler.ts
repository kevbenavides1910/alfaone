/**
 * apiHandler — Wrapper unificado para rutas de API Next.js 15.
 *
 * Elimina el boilerplate repetitivo de auth + permisos + try/catch presente en
 * las ~323 rutas de la aplicación. Adopción gradual: los routes existentes siguen
 * funcionando; se migra por módulo a conveniencia.
 *
 * Uso básico (sin params de ruta):
 * ```ts
 * export const GET = apiHandler(
 *   { permission: ["bandeco.mantenimientos", "view"] },
 *   async ({ req, session }) => ok(await listAlarmCodes(req.nextUrl.searchParams.get("q")))
 * );
 * ```
 *
 * Con params de ruta dinámica (Next.js 15 los pasa como Promise):
 * ```ts
 * export const PATCH = apiHandler(
 *   { permission: ["bandeco.mantenimientos", "edit"] },
 *   async ({ req, session, params }) => {
 *     const { id } = await params;
 *     ...
 *   }
 * );
 * ```
 */

import { NextRequest } from "next/server";
import { getSession, requirePermission } from "./middleware";
import { unauthorized, forbidden, serverError } from "./response";
import { runWithAuditContext } from "@/modules/core/db/audit-context";
import type { PermissionKey, PermissionLevelId } from "@/lib/permissions/registry";
import type { Session } from "next-auth";

// ── Tipos ──────────────────────────────────────────────────────────────────

// Next.js 15: route params son siempre Promise<Record<string, string | string[]>>
type RouteParams = Promise<Record<string, string | string[]>>;

export type HandlerContext = {
  req: NextRequest;
  session: Session;
  /** Params de ruta dinámica. Usa `await params` para obtener el valor. */
  params: RouteParams;
};

export type ApiHandlerConfig = {
  /**
   * Permiso requerido. Formato: [key, level]
   * Si se omite, solo se verifica autenticación.
   */
  permission?: [PermissionKey, PermissionLevelId];
  /**
   * Mensaje de error para el log en caso de fallo.
   * Por defecto: "Error en ruta API"
   */
  errorLabel?: string;
};

type RouteHandler = (ctx: HandlerContext) => Promise<Response>;

// Next.js 15 route handler signature — params es non-optional Promise
type NextRouteHandler = (
  req: NextRequest,
  ctx: { params: RouteParams }
) => Promise<Response>;

// ── Implementación ─────────────────────────────────────────────────────────

export function apiHandler(config: ApiHandlerConfig, handler: RouteHandler): NextRouteHandler;
export function apiHandler(handler: RouteHandler): NextRouteHandler;

export function apiHandler(
  configOrHandler: ApiHandlerConfig | RouteHandler,
  maybeHandler?: RouteHandler
): NextRouteHandler {
  const config: ApiHandlerConfig = typeof configOrHandler === "function" ? {} : configOrHandler;
  const handler: RouteHandler =
    typeof configOrHandler === "function" ? configOrHandler : maybeHandler!;

  return async (req: NextRequest, ctx: { params: RouteParams }): Promise<Response> => {
    const session = await getSession();
    if (!session) return unauthorized();

    if (config.permission) {
      const [key, level] = config.permission;
      if (!requirePermission(session, key, level)) return forbidden();
    }

    try {
      const ipAddress =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        null;

      return await runWithAuditContext(
        { userId: session.user.id, ipAddress },
        () => handler({ req, session, params: ctx.params })
      );
    } catch (e) {
      return serverError(config.errorLabel ?? "Error en ruta API", e);
    }
  };
}
