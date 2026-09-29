import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, ok } from "@/lib/api/response";
import {
  assertCanActOnEvent,
  setCalendarioStatus,
} from "@/modules/naf-operaciones/services/calendario-eventos";
import { calendarioErrorResponse } from "@/modules/naf-operaciones/services/calendario-http";
import { calendarioStatusSchema } from "@/modules/naf-operaciones/validations/calendario.schema";

/** PATCH { status: "DONE" | "SCHEDULED" } — marca la actividad como realizada o pendiente. */
export const PATCH = withPermission<{ id: string }>(async (req: NextRequest, { session, params }) => {
  const parsed = calendarioStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
  try {
    await assertCanActOnEvent(session, params.id);
    const event = await setCalendarioStatus(params.id, parsed.data.status, {
      id: session.user.id,
      name: session.user.name,
    });
    return ok(event);
  } catch (e) {
    return calendarioErrorResponse(e, "Error al cambiar el estado del evento");
  }
}, "nafOperaciones.calendario", "view");
