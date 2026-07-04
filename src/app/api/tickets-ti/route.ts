import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  listTickets,
  createTicket,
  ticketListSchema,
  ticketCreateSchema,
} from "@/modules/tickets-ti";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.centro", "view") && !hasPermission(session, "ticketsTi.tickets", "view")) {
    return forbidden();
  }

  const parsed = ticketListSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    const data = await listTickets(session, session.user.id, parsed.data);
    return ok(data);
  } catch (e) {
    return serverError("Error al listar tickets", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.tickets", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = ticketCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const row = await createTicket(session, session.user.id, parsed.data);
    return created(row);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error al crear ticket");
  }
}
