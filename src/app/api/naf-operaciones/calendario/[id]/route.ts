import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, noContent, notFound, ok, serverError } from "@/lib/api/response";
import {
  CalendarioError,
  deleteCalendarioEvent,
  getCalendarioEvent,
  updateCalendarioEvent,
} from "@/modules/naf-operaciones/services/calendario-eventos";
import { calendarioUpdateSchema } from "@/modules/naf-operaciones/validations/calendario.schema";

type Params = { id: string };

function handleError(e: unknown, fallback: string) {
  if (e instanceof CalendarioError) return e.status === 404 ? notFound(e.message) : badRequest(e.message);
  return serverError(fallback, e);
}

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const event = await getCalendarioEvent(params.id);
    return event ? ok(event) : notFound("Evento no encontrado");
  } catch (e) {
    return serverError("Error al obtener el evento", e);
  }
}, "nafOperaciones.calendario", "view");

export const PATCH = withPermission<Params>(async (req: NextRequest, { session, params }) => {
  const parsed = calendarioUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
  try {
    const event = await updateCalendarioEvent(params.id, parsed.data, {
      id: session.user.id,
      name: session.user.name,
    });
    return ok(event);
  } catch (e) {
    return handleError(e, "Error al actualizar el evento");
  }
}, "nafOperaciones.calendario", "edit");

export const DELETE = withPermission<Params>(async (_req, { params }) => {
  try {
    await deleteCalendarioEvent(params.id);
    return noContent();
  } catch (e) {
    return handleError(e, "Error al eliminar el evento");
  }
}, "nafOperaciones.calendario", "edit");
