import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import {
  getPresupuestoDetail,
  updatePresupuesto,
  presupuestoUpdateSchema,
} from "@/modules/ventas";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "view")) return forbidden();

  const { id } = await ctx.params;

  try {
    const detail = await getPresupuestoDetail(id);
    if (!detail) return notFound("Presupuesto no encontrado");
    return ok(detail);
  } catch (e) {
    return serverError("Error al cargar presupuesto", e);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "edit")) return forbidden();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = presupuestoUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const row = await updatePresupuesto(id, parsed.data);
    if (!row) return notFound("Presupuesto no encontrado");
    return ok(await getPresupuestoDetail(id));
  } catch (e) {
    return serverError("Error al actualizar presupuesto", e);
  }
}
