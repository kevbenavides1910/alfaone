import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listCxpTiposDoc } from "@/modules/cuentas-por-pagar/services/list-cxp-tipos-doc";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "cuentasPorPagar.facturas", "view")) return forbidden();

  try {
    const data = await listCxpTiposDoc();
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar tipos CXP";
    if (message.includes("Oracle NAF no configurado")) {
      return serverError(message, e);
    }
    return serverError("Error al consultar tipos de movimiento CXP", e);
  }
}
