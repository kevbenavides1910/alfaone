import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { activacionSchema } from "@/modules/monitoreo/validations/schemas";
import { registrarActivacion, listActivaciones } from "@/modules/monitoreo/services/activaciones";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.registros", "view")) return forbidden();

  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "200");
    const desde = req.nextUrl.searchParams.get("desde");
    const hasta = req.nextUrl.searchParams.get("hasta");

    const rows = await listActivaciones({
      limit: Number.isFinite(limit) ? limit : 200,
      desde: desde ? new Date(desde) : undefined,
      hasta: hasta ? new Date(hasta) : undefined,
    });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar activaciones", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.operacion", "edit")) return forbidden();

  try {
    const body = await req.json();
    const parsed = activacionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await registrarActivacion({
      ...parsed.data,
      operadorName: session.user.name ?? session.user.email ?? "Operador",
      operadorId: session.user.id ?? null,
    });
    return created(row);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al registrar activación";
    return badRequest(msg);
  }
}
