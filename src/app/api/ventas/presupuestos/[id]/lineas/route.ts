import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, created, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import {
  addPresupuestoLinea,
  presupuestoLineaSchema,
} from "@/modules/ventas";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
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

  const parsed = presupuestoLineaSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const linea = await addPresupuestoLinea(id, parsed.data);
    if (!linea) return notFound("Presupuesto no encontrado");
    return created(linea);
  } catch (e) {
    return serverError("Error al agregar línea", e);
  }
}
