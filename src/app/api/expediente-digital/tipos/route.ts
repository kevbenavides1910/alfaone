import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listTiposDocumento } from "@/modules/expediente-digital";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "expedienteDigital.list", "view")) return forbidden();

  try {
    const tipos = await listTiposDocumento();
    return ok({ tipos });
  } catch (e) {
    return serverError("Error al listar tipos de documento", e);
  }
}
