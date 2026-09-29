import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import {
  CalendarioError,
  setCalendarioCompletion,
} from "@/modules/naf-operaciones/services/calendario-eventos";
import { calendarioCompletionSchema } from "@/modules/naf-operaciones/validations/calendario.schema";

/** PATCH { contractIds?: string[], completed: boolean } — sin contractIds aplica a todos los del evento. */
export const PATCH = withPermission<{ id: string }>(async (req: NextRequest, { session, params }) => {
  const parsed = calendarioCompletionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
  try {
    const event = await setCalendarioCompletion(params.id, parsed.data, {
      id: session.user.id,
      name: session.user.name,
    });
    return ok(event);
  } catch (e) {
    if (e instanceof CalendarioError) return e.status === 404 ? notFound(e.message) : badRequest(e.message);
    return serverError("Error al actualizar el avance del evento", e);
  }
}, "nafOperaciones.calendario", "edit");
