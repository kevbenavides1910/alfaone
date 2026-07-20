import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  getVacacionesPersonalByCedula,
  searchVacacionesPersonal,
} from "@/modules/empleados-naf/services/vacaciones-personal";

/** Compat: la pestaña vive en Empleados NAF; se mantiene este path. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.vacacionesPersonal", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const cedula = sp.get("cedula")?.trim();
    const q = sp.get("q")?.trim();

    if (cedula) {
      const detail = await getVacacionesPersonalByCedula(cedula);
      if (!detail) return badRequest("No se encontró personal con esa cédula");
      return ok(detail);
    }

    if (!q || q.length < 2) {
      return badRequest("Indique q (nombre/código/cédula) o cedula");
    }

    const candidates = await searchVacacionesPersonal(q, 30);
    return ok({ candidates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/NJS-045|DPI-1047|Oracle Instant Client|Thick mode/i.test(msg)) {
      return serverError(
        "Oracle no disponible en el servidor (Instant Client / oracledb). Reintente tras despliegue.",
        e,
      );
    }
    return serverError("Error al consultar vacaciones de personal", e);
  }
}
