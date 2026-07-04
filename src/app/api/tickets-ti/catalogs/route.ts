import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  getCreateFormCatalogs,
  listCatalogs,
  upsertCatalog,
  updatePrioritySla,
  catalogUpsertSchema,
  prioritySlaUpdateSchema,
  catalogItemUpdateSchema,
  catalogItemDeleteSchema,
  catalogTechnicianAddSchema,
} from "@/modules/tickets-ti";
import {
  updateCatalogItem,
  deleteCatalogItem,
  addTechnicianToCatalog,
  updateTechnicianCatalogItem,
  deleteTechnicianCatalogItem,
} from "@/modules/tickets-ti/services/catalog-admin";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const forForm = req.nextUrl.searchParams.get("for") === "create";
  if (forForm) {
    if (!hasPermission(session, "ticketsTi.tickets", "edit")) return forbidden();
    try {
      return ok(await getCreateFormCatalogs());
    } catch (e) {
      return serverError("Error al cargar catálogos", e);
    }
  }
  if (!hasPermission(session, "ticketsTi.admin", "view")) return forbidden();
  try {
    return ok(await listCatalogs());
  } catch (e) {
    return serverError("Error al cargar catálogos", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.admin", "admin")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const techParsed = catalogTechnicianAddSchema.safeParse(body);
  if (techParsed.success) {
    try {
      const row = await addTechnicianToCatalog(
        techParsed.data.userId,
        techParsed.data.sortOrder ?? 0
      );
      return ok(row);
    } catch (e) {
      return badRequest(e instanceof Error ? e.message : "Error al agregar técnico");
    }
  }

  const parsed = catalogUpsertSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const row = await upsertCatalog(parsed.data);
    return ok(row);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error al guardar catálogo");
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.admin", "admin")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const slaParsed = prioritySlaUpdateSchema.safeParse(body);
  if (slaParsed.success) {
    try {
      const row = await updatePrioritySla(slaParsed.data.priorityId, slaParsed.data.slaMinutes);
      return ok(row);
    } catch (e) {
      return serverError("Error al actualizar SLA", e);
    }
  }

  const parsed = catalogItemUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    if (parsed.data.kind === "technician") {
      const row = await updateTechnicianCatalogItem(parsed.data.id, {
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
      });
      return ok(row);
    }

    const { kind, id, ...fields } = parsed.data;
    const row = await updateCatalogItem(kind, id, fields);
    return ok(row);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error al actualizar ítem");
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ticketsTi.admin", "admin")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = catalogItemDeleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    if (parsed.data.kind === "technician") {
      return ok(await deleteTechnicianCatalogItem(parsed.data.id));
    }
    return ok(await deleteCatalogItem(parsed.data.kind, parsed.data.id));
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Error al eliminar ítem");
  }
}
