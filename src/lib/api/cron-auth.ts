import type { NextRequest } from "next/server";

/** Rutas API que validan Bearer cron en el handler (no NextAuth en middleware). */
export const CRON_SELF_AUTH_API_PATHS = [
  "/api/empleados-naf/sync",
  "/api/empleados-naf/nomina/sync",
  "/api/fe/cron/jobs",
  "/api/fe/cron/imap",
  "/api/cron/facturacion-cobro-emails",
  "/api/cron/patrol-welfare",
  "/api/cron/notifications/archive",
  "/api/cron/finger-sync",
  "/api/ventas/oportunidades/ingest",
] as const;

export function isSelfAuthenticatedCronApi(pathname: string): boolean {
  return (CRON_SELF_AUTH_API_PATHS as readonly string[]).includes(pathname);
}

/** Valida llamadas de cron del VPS (Bearer o ?secret=). */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.SYNTRA_CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  return req.nextUrl.searchParams.get("secret") === secret;
}

/** Cron NAF: SYNTRA_CRON_SECRET o NAF_SYNC_CRON_SECRET. */
export function isNafSyncCronAuthorized(req: NextRequest): boolean {
  if (isCronAuthorized(req)) return true;
  const nafSecret = process.env.NAF_SYNC_CRON_SECRET?.trim();
  if (!nafSecret) return false;
  return req.headers.get("authorization") === `Bearer ${nafSecret}`;
}
