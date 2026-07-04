import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  getParametrosGenerales,
  updateParametrosGenerales,
  updateCatalogItemGlobal,
  createGlobalCatalogItem,
  deleteGlobalCatalogItem,
  parametrosGeneralesUpdateSchema,
  catalogItemUpdateSchema,
  catalogItemCreateSchema,
  catalogItemDeleteSchema,
} from "@/modules/ventas";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "view")) return forbidden();

  try {
    return ok(await getParametrosGenerales());
  } catch (e) {
    return serverError("Error al cargar parametrización", e);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = parametrosGeneralesUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const config = await updateParametrosGenerales(parsed.data);
    return ok({ config });
  } catch (e) {
    return serverError("Error al actualizar parametrización", e);
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = catalogItemUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const result = await updateCatalogItemGlobal(parsed.data);
    if (!result) return badRequest("Ítem no encontrado");
    return ok(result);
  } catch (e) {
    return serverError("Error al actualizar catálogo", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = catalogItemCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const item = parsed.data.item;
    if (parsed.data.section === "salarios" && item.valor != null && !item.valoresPorAnio) {
      const config = await getParametrosGenerales();
      const year = String(config.config.anioBase);
      item.valoresPorAnio = { [year]: Number(item.valor) };
    }
    await createGlobalCatalogItem(parsed.data);
    return ok(await getParametrosGenerales());
  } catch (e) {
    return serverError("Error al crear línea", e);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = catalogItemDeleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    await deleteGlobalCatalogItem(parsed.data.section, parsed.data.codigo);
    return ok(await getParametrosGenerales());
  } catch (e) {
    return serverError("Error al eliminar línea", e);
  }
}
