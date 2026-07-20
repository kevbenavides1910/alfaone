import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { getLiveE5Status } from "@/modules/empleados/services/photorec-review";

/** Estado E5 vivo para el empleado seleccionado en revisión PhotoRec. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "view")) return forbidden();

  try {
    const noEmple = req.nextUrl.searchParams.get("noEmple")?.trim() ?? "";
    if (!noEmple) return badRequest("Requiere noEmple");
    const status = await getLiveE5Status(noEmple);
    return ok(status);
  } catch (e) {
    return serverError("Error al consultar E5 vivo", e);
  }
}
