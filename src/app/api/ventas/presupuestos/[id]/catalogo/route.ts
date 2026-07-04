import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import {
  updatePresupuestoCatalogOverride,
  getPresupuestoDetail,
  catalogItemUpdateSchema,
  catalogItemCreateSchema,
  catalogItemDeleteSchema,
  recalcularPresupuesto,
  addPresupuestoCatalogLine,
  removePresupuestoCatalogLine,
  getParametrosGenerales,
} from "@/modules/ventas";

type RouteCtx = { params: Promise<{ id: string }> };

async function respondDetail(id: string) {
  await recalcularPresupuesto(id);
  const detail = await getPresupuestoDetail(id);
  return ok(detail);
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

  const parsed = catalogItemUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const overrides = await updatePresupuestoCatalogOverride(id, parsed.data);
    if (overrides == null) return notFound("Presupuesto no encontrado");
    return respondDetail(id);
  } catch (e) {
    return serverError("Error al actualizar catálogo del presupuesto", e);
  }
}

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

  const parsed = catalogItemCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const item = { ...parsed.data.item };
    if (parsed.data.section === "salarios" && item.valor != null && !item.valoresPorAnio) {
      const detail = await getPresupuestoDetail(id);
      const year = String(detail?.presupuesto.anioBase ?? (await getParametrosGenerales()).config.anioBase);
      item.valoresPorAnio = { [year]: Number(item.valor) };
    }
    const result = await addPresupuestoCatalogLine(id, { ...parsed.data, item });
    if (result == null) return notFound("Presupuesto no encontrado");
    return respondDetail(id);
  } catch (e) {
    return serverError("Error al agregar línea", e);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
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

  const parsed = catalogItemDeleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const result = await removePresupuestoCatalogLine(id, parsed.data.section, parsed.data.codigo);
    if (result == null) return notFound("Presupuesto no encontrado");
    return respondDetail(id);
  } catch (e) {
    return serverError("Error al eliminar línea", e);
  }
}
