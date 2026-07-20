import { NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { ok, serverError, unauthorized } from "@/lib/api/response";
import { archiveStaleInboxNotifications } from "@/modules/notifications";

async function runArchive() {
  const result = await archiveStaleInboxNotifications();
  return ok(result);
}

/** Archiva notificaciones visibles > 3 días al historial. */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return unauthorized();
  try {
    return await runArchive();
  } catch (e) {
    return serverError("Error al archivar notificaciones", e);
  }
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return unauthorized();
  try {
    return await runArchive();
  } catch (e) {
    return serverError("Error al archivar notificaciones", e);
  }
}
