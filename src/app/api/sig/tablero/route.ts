import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { forbidden, ok, serverError, unauthorized } from "@/lib/api/response";
import { getSigSgcDashboard } from "@/modules/sig";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !hasPermission(session, "sig.requisitos", "view") &&
    !hasPermission(session, "sig.biblioteca", "view") &&
    !hasPermission(session, "sig.auditorias", "view")
  ) {
    return forbidden();
  }

  try {
    const data = await getSigSgcDashboard();
    return ok(data);
  } catch (e) {
    return serverError("Error al cargar tablero SGC", e);
  }
}
