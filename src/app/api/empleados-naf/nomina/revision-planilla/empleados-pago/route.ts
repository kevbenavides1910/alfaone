import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { getRevisionPlanillaEmpleadosPorCanal } from "@/modules/empleados-naf/services/revision-planilla-empleados-pago";

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
    const canal = sp.get("canal")?.trim();

    if (!noCia || !codPla || !fDesde || !fHasta || !canal) {
      return badRequest("Parámetros requeridos: noCia, codPla, fDesde, fHasta, canal");
    }

    const reporte = await getRevisionPlanillaEmpleadosPorCanal({
      noCia,
      codPla,
      fDesde,
      fHasta,
      canal,
    });
    return ok({ reporte });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar empleados por forma de pago";
    if (
      message.includes("No se encontró") ||
      message.includes("requeridos") ||
      message.includes("inválid") ||
      message.includes("Canal inválido")
    ) {
      return badRequest(message);
    }
    return serverError("Error al consultar empleados por forma de pago NAF", e);
  }
}
