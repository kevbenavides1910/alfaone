import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { consultarCodigoAlarma } from "@/modules/bandeco/services/consulta";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.consulta", "view")) return forbidden();

  try {
    const { code } = await params;
    const alarmNumber = Number(code);
    if (!Number.isFinite(alarmNumber) || alarmNumber <= 0) {
      return badRequest("Código de alarma inválido");
    }

    const result = await consultarCodigoAlarma(alarmNumber);
    if (!result) return notFound("Código de alarma no encontrado");
    return ok(result);
  } catch (e) {
    return serverError("Error en consulta", e);
  }
}
