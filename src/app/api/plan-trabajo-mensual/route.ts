import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden } from "@/lib/api/response";

/** Listado del plan de trabajo mensual (sin modelo de datos todavía). */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "planTrabajoMensual.plan", "view")) return forbidden();

  return ok({ items: [] });
}
