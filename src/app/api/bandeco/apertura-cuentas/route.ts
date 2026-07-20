import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { aperturaCuentaSchema } from "@/modules/bandeco/validations/schemas";
import { listAperturaCuentas, createAperturaCuenta } from "@/modules/bandeco/services/catalogs-service";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "view")) return forbidden();
  try {
    return ok(await listAperturaCuentas(req.nextUrl.searchParams.get("finca")));
  } catch (e) {
    return serverError("Error al listar cuentas de apertura", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();
  try {
    const parsed = aperturaCuentaSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return created(await createAperturaCuenta(parsed.data));
  } catch (e) {
    return serverError("Error al crear cuenta de apertura", e);
  }
}
