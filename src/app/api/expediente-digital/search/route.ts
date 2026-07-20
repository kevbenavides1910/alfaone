import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { searchExpedientePersonas } from "@/modules/expediente-digital";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "expedienteDigital.list", "view")) return forbidden();

  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return badRequest("Indique q (nombre, código o cédula) con al menos 2 caracteres");
    }
    const candidates = await searchExpedientePersonas(q, 30);
    return ok({ candidates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/NJS-045|DPI-1047|Oracle Instant Client|Thick mode/i.test(msg)) {
      return serverError(
        "Oracle no disponible en el servidor (Instant Client / oracledb).",
        e,
      );
    }
    return serverError("Error al buscar en expediente digital", e);
  }
}
