import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listActiveTechniciansForForm } from "@/modules/tickets-ti/services/catalog-admin";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.centro", "view")) return forbidden();

  try {
    return ok(await listActiveTechniciansForForm());
  } catch (e) {
    return serverError("Error al listar técnicos", e);
  }
}
