import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { apiHandler } from "@/lib/api/handler";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { pilaFincaSchema } from "@/modules/bandeco/validations/schemas";
import { listPilasFincas, createPilaFinca } from "@/modules/bandeco/services/catalogs-service";

// GET requiere mantenimientos OR operacion — dual permission no encaja en apiHandler simple
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !requirePermission(session, "bandeco.mantenimientos", "view") &&
    !requirePermission(session, "bandeco.operacion", "view")
  ) {
    return forbidden();
  }
  try {
    return ok(await listPilasFincas());
  } catch (e) {
    return serverError("Error al listar fincas de pilas", e);
  }
}

export const POST = apiHandler(
  { permission: ["bandeco.mantenimientos", "edit"], errorLabel: "Error al crear finca de pilas" },
  async ({ req }) => {
    const parsed = pilaFincaSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return created(await createPilaFinca(parsed.data));
  }
);
