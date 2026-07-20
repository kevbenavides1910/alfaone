import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getLatestNafNominaSyncRun } from "@/modules/empleados-naf/services/sync-nomina";
import { countNafNominaSummaryRows } from "@/modules/empleados-naf/services/list-nomina";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.nomina", "view")) return forbidden();

  try {
    const [lastSync, totalRows] = await Promise.all([
      getLatestNafNominaSyncRun(),
      countNafNominaSummaryRows(),
    ]);
    return ok({ lastSync, totalRows });
  } catch (e) {
    return serverError("Error al consultar estado de sincronización de nómina NAF", e);
  }
}
