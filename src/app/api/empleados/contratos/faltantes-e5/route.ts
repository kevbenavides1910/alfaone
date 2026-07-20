import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listFaltantesE5 } from "@/modules/empleados/services/faltantes-e5-tracking";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "view")) return forbidden();

  try {
    const includeEnExpediente = req.nextUrl.searchParams.get("includeEnExpediente") !== "0";
    const result = await listFaltantesE5({ includeEnExpediente });
    return ok(result);
  } catch (e) {
    return serverError("Error al listar activos sin E5", e);
  }
}
