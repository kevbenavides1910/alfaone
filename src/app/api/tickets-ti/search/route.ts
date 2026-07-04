import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { searchTickets, ticketSearchSchema } from "@/modules/tickets-ti";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.centro", "view")) return forbidden();

  const parsed = ticketSearchSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    return ok(await searchTickets(session, session.user.id, parsed.data.q, parsed.data.limit));
  } catch (e) {
    return serverError("Error en búsqueda", e);
  }
}
