import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { addTicketComment, ticketCommentSchema } from "@/modules/tickets-ti";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.tickets", "view")) return forbidden();

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = ticketCommentSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const row = await addTicketComment(session, session.user.id, id, parsed.data);
    return created(row);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error al comentar");
  }
}
