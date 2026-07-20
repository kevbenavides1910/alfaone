import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { getExpedientePersona } from "@/modules/expediente-digital";

type Ctx = { params: Promise<{ cedula: string }> };

export async function GET(_req: NextRequest, context: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "expedienteDigital.list", "view")) return forbidden();

  try {
    const { cedula: raw } = await context.params;
    const cedula = decodeURIComponent(raw || "").trim();
    if (!cedula) return badRequest("Cédula requerida");

    const detail = await getExpedientePersona(cedula);
    if (!detail) return badRequest("No se encontró personal con esa cédula");
    return ok(detail);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/NJS-045|DPI-1047|Oracle Instant Client|Thick mode/i.test(msg)) {
      return serverError(
        "Oracle no disponible en el servidor (Instant Client / oracledb).",
        e,
      );
    }
    return serverError("Error al cargar expediente", e);
  }
}
