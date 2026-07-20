import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getNafContractReconciliation } from "@/modules/empleados-naf/services/naf-contract-reconciliation";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.homologacion", "view")) return forbidden();

  try {
    const data = await getNafContractReconciliation();
    return ok(data);
  } catch (e) {
    return serverError("Error al consultar homologación de contratos NAF", e);
  }
}
