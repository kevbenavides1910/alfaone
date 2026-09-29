import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, notFound, ok, serverError } from "@/lib/api/response";
import {
  deleteCalendarioEventType,
  updateCalendarioEventType,
} from "@/modules/naf-operaciones/services/calendario-tipos";
import { calendarioTipoPatchSchema } from "@/modules/naf-operaciones/validations/calendario.schema";

type Params = { id: string };

export const PATCH = withPermission<Params>(async (req: NextRequest, { params }) => {
  const parsed = calendarioTipoPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
  try {
    const result = await updateCalendarioEventType(params.id, parsed.data);
    if (!result.ok) return result.status === 404 ? notFound(result.message) : badRequest(result.message);
    return ok(result.row);
  } catch (e) {
    return serverError("Error al actualizar tipo de evento", e);
  }
}, "plataforma.catalogs", "edit");

export const DELETE = withPermission<Params>(async (_req, { params }) => {
  try {
    const result = await deleteCalendarioEventType(params.id);
    if (!result.ok) return result.status === 404 ? notFound(result.message) : badRequest(result.message);
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar tipo de evento", e);
  }
}, "plataforma.catalogs", "edit");
