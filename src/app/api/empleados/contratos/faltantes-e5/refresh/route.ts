import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { refreshFaltantesE5Baseline } from "@/modules/empleados/services/faltantes-e5-tracking";

export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "edit")) return forbidden();

  try {
    const result = await refreshFaltantesE5Baseline();
    return ok(result);
  } catch (e) {
    return serverError("Error al refrescar lista de faltantes E5", e);
  }
}
