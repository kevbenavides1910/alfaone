import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  listPresupuestos,
  createPresupuesto,
  presupuestoCreateSchema,
  presupuestoListSchema,
} from "@/modules/ventas";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "view")) return forbidden();

  const parsed = presupuestoListSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    return ok(await listPresupuestos(parsed.data));
  } catch (e) {
    return serverError("Error al listar presupuestos", e);
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

  const parsed = presupuestoCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const { created: isNew, row } = await createPresupuesto(parsed.data, session.user.id);
    if (!isNew) {
      return badRequest("Ya existe un presupuesto para esta oportunidad");
    }
    return created(row);
  } catch (e) {
    return serverError("Error al crear presupuesto", e);
  }
}
