import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import {
  updateOportunidadEstado,
  oportunidadUpdateEstadoSchema,
} from "@/modules/ventas";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.oportunidades", "edit")) return forbidden();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = oportunidadUpdateEstadoSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const row = await updateOportunidadEstado(id, parsed.data, session.user.id);
    if (!row) return notFound("Oportunidad no encontrada");
    return ok(row);
  } catch (e) {
    return serverError("Error al actualizar oportunidad", e);
  }
}
