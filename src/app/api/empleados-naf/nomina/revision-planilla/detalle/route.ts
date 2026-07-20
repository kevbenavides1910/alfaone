import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { getRevisionPlanillaDetalle } from "@/modules/empleados-naf/services/revision-planilla-detalle";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.revisionPlanilla", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const noCia = sp.get("noCia")?.trim();
    const codPla = sp.get("codPla")?.trim();
    const fDesde = sp.get("fDesde")?.trim();
    const fHasta = sp.get("fHasta")?.trim();

    if (!noCia || !codPla || !fDesde || !fHasta) {
      return badRequest("Parámetros requeridos: noCia, codPla, fDesde, fHasta");
    }

    const detalle = await getRevisionPlanillaDetalle({ noCia, codPla, fDesde, fHasta });
    return ok({ detalle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar detalle de planilla";
    if (message.includes("No se encontró") || message.includes("requeridos") || message.includes("inválid")) {
      return badRequest(message);
    }
    return serverError("Error al consultar detalle de planilla NAF", e);
  }
}
