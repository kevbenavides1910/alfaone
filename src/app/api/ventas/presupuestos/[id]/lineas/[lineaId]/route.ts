import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { noContent, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { deletePresupuestoLinea } from "@/modules/ventas";

type RouteCtx = { params: Promise<{ id: string; lineaId: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "edit")) return forbidden();

  const { id, lineaId } = await ctx.params;

  try {
    const okDel = await deletePresupuestoLinea(id, lineaId);
    if (!okDel) return notFound("Línea no encontrada");
    return noContent();
  } catch (e) {
    return serverError("Error al eliminar línea", e);
  }
}
