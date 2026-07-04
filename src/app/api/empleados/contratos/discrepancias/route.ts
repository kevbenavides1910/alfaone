import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getContractReconciliation } from "@/modules/empleados/services/contract-reconciliation";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "view")) return forbidden();

  try {
    const result = await getContractReconciliation();
    return ok(result);
  } catch (e) {
    return serverError("Error al analizar discrepancias de contratos", e);
  }
}
