import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { pilaFincaSchema } from "@/modules/monitoreo/validations/schemas";
import { listPilasFincas, createPilaFinca } from "@/modules/monitoreo/services/catalogs-service";

// GET requiere mantenimientos OR operacion — dual permission no encaja en apiHandler simple
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !requirePermission(session, "monitoreo.mantenimientos", "view") &&
    !requirePermission(session, "monitoreo.operacion", "view")
  ) {
    return forbidden();
  }
  try {
    return ok(await listPilasFincas());
  } catch (e) {
    return serverError("Error al listar fincas de pilas", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  // Operadores pueden agregar ubicaciones desde el llenado diario;
  // mantenimientos sigue pudiendo gestionar el catálogo.
  if (
    !requirePermission(session, "monitoreo.mantenimientos", "edit") &&
    !requirePermission(session, "monitoreo.operacion", "edit")
  ) {
    return forbidden();
  }

  try {
    const parsed = pilaFincaSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return created(await createPilaFinca(parsed.data));
  } catch (e) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "P2002") return badRequest("Ya existe una ubicación con ese nombre");
    return serverError("Error al crear finca de pilas", e);
  }
}
