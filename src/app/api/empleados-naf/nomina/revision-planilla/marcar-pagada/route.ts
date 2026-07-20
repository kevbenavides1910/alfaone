import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { marcarPagadaFlujo } from "@/modules/empleados-naf/services/revision-planilla-pago-flujo";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.revisionPlanilla", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      noCia?: string;
      codPla?: string;
      fDesde?: string;
      fHasta?: string;
    };
    const noCia = body.noCia?.trim();
    const codPla = body.codPla?.trim();
    const fDesde = body.fDesde?.trim();
    const fHasta = body.fHasta?.trim();
    if (!noCia || !codPla || !fDesde || !fHasta) {
      return badRequest("Parámetros requeridos: noCia, codPla, fDesde, fHasta");
    }
    const checklist = await marcarPagadaFlujo({
      noCia,
      codPla,
      fDesde,
      fHasta,
      userLabel: session.user?.email ?? session.user?.name ?? session.user?.id ?? null,
    });
    return ok({ checklist });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al marcar pagada";
    if (message.includes("requeridos") || message.includes("Debe preparar") || message.includes("inválid")) {
      return badRequest(message);
    }
    return serverError("Error al marcar planilla como pagada", e);
  }
}
