import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, created, ok, serverError } from "@/lib/api/response";
import {
  createCalendarioEventType,
  listCalendarioEventTypesAdmin,
} from "@/modules/naf-operaciones/services/calendario-tipos";
import { calendarioTipoCreateSchema } from "@/modules/naf-operaciones/validations/calendario.schema";

export const GET = withPermission(async () => {
  try {
    return ok(await listCalendarioEventTypesAdmin());
  } catch (e) {
    return serverError("Error al obtener tipos de evento", e);
  }
}, "plataforma.catalogs", "view");

export const POST = withPermission(async (req: NextRequest) => {
  const parsed = calendarioTipoCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
  try {
    const result = await createCalendarioEventType(parsed.data);
    if (!result.ok) return badRequest(result.message);
    return created(result.row);
  } catch (e) {
    return serverError("Error al crear tipo de evento", e);
  }
}, "plataforma.catalogs", "edit");
