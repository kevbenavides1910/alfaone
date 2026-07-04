import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import {
  upsertTolerancia,
  presupuestoToleranciaSchema,
} from "@/modules/ventas";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: RouteCtx) {
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

  const parsed = presupuestoToleranciaSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const row = await upsertTolerancia(id, parsed.data);
    if (!row) return notFound("Presupuesto no encontrado");
    return ok(row);
  } catch (e) {
    return serverError("Error al guardar tolerancia", e);
  }
}
