import { NextRequest } from "next/server";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { aperturaCuentaSchema } from "@/modules/bandeco/validations/schemas";
import { getAperturaCuenta, updateAperturaCuenta, deleteAperturaCuenta } from "@/modules/bandeco/services/catalogs-service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "edit")) return forbidden();
  try {
    const { id } = await params;
    if (!await getAperturaCuenta(id)) return notFound("Cuenta no encontrada");
    const parsed = aperturaCuentaSchema.partial().safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await updateAperturaCuenta(id, parsed.data));
  } catch (e) {
    return serverError("Error al actualizar cuenta", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "bandeco.mantenimientos", "admin")) return forbidden();
  try {
    const { id } = await params;
    if (!await getAperturaCuenta(id)) return notFound("Cuenta no encontrada");
    await deleteAperturaCuenta(id);
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar cuenta", e);
  }
}
