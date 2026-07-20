import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listReconstruccionItems } from "@/modules/empleados/services/reconstruccion-e5-review";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "view")) return forbidden();

  try {
    const result = await listReconstruccionItems();
    return ok(result);
  } catch (e) {
    return serverError("Error al listar contratos reconstruidos", e);
  }
}
