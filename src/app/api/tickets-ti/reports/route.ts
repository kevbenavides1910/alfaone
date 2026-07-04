import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getTicketsReports } from "@/modules/tickets-ti";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.centro", "view")) return forbidden();

  try {
    return ok(await getTicketsReports(session, session.user.id));
  } catch (e) {
    return serverError("Error al generar reportes", e);
  }
}
