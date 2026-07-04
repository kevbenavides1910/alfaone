import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, created, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  listOportunidades,
  createOportunidad,
  oportunidadCreateSchema,
  oportunidadListSchema,
} from "@/modules/ventas";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.oportunidades", "view")) return forbidden();

  const parsed = oportunidadListSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    return ok(await listOportunidades(parsed.data));
  } catch (e) {
    return serverError("Error al listar oportunidades", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.oportunidades", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = oportunidadCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const { created: isNew, row } = await createOportunidad(parsed.data);
    if (!isNew) {
      return badRequest(`La licitación ${row.licitacionNo} ya está registrada`);
    }
    return created(row);
  } catch (e) {
    return serverError("Error al registrar oportunidad", e);
  }
}
