import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError, badRequest } from "@/lib/api/response";
import { isCronAuthorized } from "@/lib/api/cron-auth";
import { syncNafEmployees } from "@/modules/empleados-naf/services/sync-employees";

function isNafSyncCron(req: NextRequest): boolean {
  if (isCronAuthorized(req)) return true;
  const nafSecret = process.env.NAF_SYNC_CRON_SECRET?.trim();
  if (!nafSecret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${nafSecret}`;
}

export async function POST(req: NextRequest) {
  const isCron = isNafSyncCron(req);

  if (!isCron) {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!hasPermission(session, "empleadosNaf.sync", "edit")) return forbidden();
  }

  try {
    const triggeredBy = isCron ? "cron" : "manual";
    const result = await syncNafEmployees({ triggeredBy });
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al sincronizar empleados NAF";
    return badRequest(message, e);
  }
}
