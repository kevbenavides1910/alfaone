import { NextRequest } from "next/server";
import { getSession, canManageCatalogsSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { assetTypePatchSchema } from "@/modules/inventario/validations/asset-type.schema";
import { updateAssetType, deleteAssetType } from "@/modules/inventario/services/asset-types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageCatalogsSession(session)) return forbidden();
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = assetTypePatchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await updateAssetType(id, parsed.data);
    if (!result.ok) return notFound();
    return ok(result.row);
  } catch (e) {
    return serverError("Error al actualizar tipo", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageCatalogsSession(session)) return forbidden();
  const { id } = await params;
  try {
    const result = await deleteAssetType(id);
    if (!result.ok) {
      if (result.reason === "not_found") return notFound();
      return badRequest(result.message);
    }
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar tipo", e);
  }
}
