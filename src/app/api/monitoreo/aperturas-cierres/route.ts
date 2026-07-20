import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { aperturaCierreSchema } from "@/modules/monitoreo/validations/schemas";
import {
  registrarAperturaCierre,
  listAperturasCierres,
  listCierresPendientes,
} from "@/modules/monitoreo/services/aperturas-cierres";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.registros", "view")) return forbidden();

  try {
    const pendientes = req.nextUrl.searchParams.get("pendientes") === "1";
    if (pendientes) {
      const fecha = req.nextUrl.searchParams.get("fecha");
      return ok(await listCierresPendientes(fecha ? new Date(fecha) : undefined));
    }

    const fecha = req.nextUrl.searchParams.get("fecha");
    const rows = await listAperturasCierres({
      fecha: fecha ? new Date(fecha) : undefined,
    });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar aperturas/cierres", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.operacion", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = aperturaCierreSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await registrarAperturaCierre({
      ...parsed.data,
      operadorName: parsed.data.operadorName || session.user.name || "Operador",
    });
    return created(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al registrar apertura/cierre";
    return badRequest(msg);
  }
}
