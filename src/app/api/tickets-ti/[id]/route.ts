import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  badRequest,
  serverError,
} from "@/lib/api/response";
import {
  getTicketDetail,
  assignTicket,
  changeTicketStatus,
  ticketAssignSchema,
  ticketStatusSchema,
} from "@/modules/tickets-ti";
import { canViewInternalComments } from "@/modules/tickets-ti/services/ticket-access";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.tickets", "view")) return forbidden();

  const { id } = await params;
  try {
    const row = await getTicketDetail(
      session,
      session.user.id,
      id,
      canViewInternalComments(session)
    );
    if (!row) return notFound("Ticket no encontrado");
    return ok(row);
  } catch (e) {
    return serverError("Error al obtener ticket", e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.tickets", "edit")) return forbidden();

  const { id } = await params;
  const action = new URL(req.url).searchParams.get("action");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    if (action === "assign") {
      const parsed = ticketAssignSchema.safeParse(body);
      if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
      return ok(await assignTicket(session, session.user.id, id, parsed.data.assignedToId));
    }
    if (action === "status") {
      const parsed = ticketStatusSchema.safeParse(body);
      if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
      return ok(
        await changeTicketStatus(session, session.user.id, id, {
          statusCode: parsed.data.statusCode,
          reason: parsed.data.reason,
          solution: parsed.data.solution,
          workMinutes: parsed.data.workMinutes,
        })
      );
    }
    return badRequest("Acción no reconocida. Use ?action=assign o ?action=status");
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error al actualizar ticket");
  }
}
