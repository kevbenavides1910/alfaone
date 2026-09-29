import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, created, ok, serverError } from "@/lib/api/response";
import {
  CalendarioError,
  createCalendarioEvent,
  listCalendarioEvents,
} from "@/modules/naf-operaciones/services/calendario-eventos";
import {
  calendarioCreateSchema,
  calendarioListQuerySchema,
} from "@/modules/naf-operaciones/validations/calendario.schema";

/** GET /api/naf-operaciones/calendario?from=YYYY-MM-DD&to=YYYY-MM-DD[&zoneId=&contractId=&type=] */
export const GET = withPermission(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const parsed = calendarioListQuerySchema.safeParse({
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    zoneId: sp.get("zoneId") || undefined,
    contractId: sp.get("contractId") || undefined,
    type: sp.get("type") || undefined,
  });
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());
  try {
    return ok(await listCalendarioEvents(parsed.data));
  } catch (e) {
    return serverError("Error al listar el calendario operativo", e);
  }
}, "nafOperaciones.calendario", "view");

export const POST = withPermission(async (req: NextRequest, { session }) => {
  const parsed = calendarioCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
  try {
    const event = await createCalendarioEvent(parsed.data, {
      id: session.user.id,
      name: session.user.name,
    });
    return created(event);
  } catch (e) {
    if (e instanceof CalendarioError) return badRequest(e.message);
    return serverError("Error al crear el evento", e);
  }
}, "nafOperaciones.calendario", "edit");
