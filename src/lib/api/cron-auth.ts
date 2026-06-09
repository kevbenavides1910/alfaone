import type { NextRequest } from "next/server";

/** Valida llamadas de cron del VPS (Bearer o ?secret=). */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.SYNTRA_CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  return req.nextUrl.searchParams.get("secret") === secret;
}
