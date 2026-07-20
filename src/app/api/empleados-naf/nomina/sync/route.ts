import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { isNafSyncCronAuthorized } from "@/lib/api/cron-auth";
import { syncNafNomina } from "@/modules/empleados-naf/services/sync-nomina";

export async function POST(req: NextRequest) {
  const isCron = isNafSyncCronAuthorized(req);

  if (!isCron) {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!hasPermission(session, "empleadosNaf.sync", "edit")) return forbidden();
  }

  try {
    const sp = req.nextUrl.searchParams;
    const desdeAnoRaw = sp.get("desdeAno");
    const desdeAno = desdeAnoRaw ? Number.parseInt(desdeAnoRaw, 10) : undefined;
    if (desdeAnoRaw && (desdeAno == null || Number.isNaN(desdeAno))) {
      return badRequest("desdeAno inválido");
    }

    const triggeredBy = isCron ? "cron" : "manual";
    const result = await syncNafNomina({ triggeredBy, desdeAno });
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al sincronizar nómina NAF";
    return badRequest(message, e);
  }
}
