import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { buildInformeSemanal } from "@/modules/monitoreo/services/activaciones";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.registros", "view")) return forbidden();

  try {
    const desde = req.nextUrl.searchParams.get("desde");
    const hasta = req.nextUrl.searchParams.get("hasta");
    if (!desde || !hasta) return badRequest("Parámetros desde y hasta requeridos");

    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return badRequest("Fechas inválidas");
    }

    const texto = await buildInformeSemanal(d1, d2);
    return ok({ texto, desde: d1, hasta: d2 });
  } catch (e) {
    return serverError("Error al generar informe semanal", e);
  }
}
