import { NextRequest } from "next/server";
import { getSession, canManageExpenses } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { assetPatchSchema } from "@/modules/inventario/validations/asset.schema";
import {
  getAssetDetail,
  validateAssetPatch,
  buildAssetPatchData,
  updateAsset,
  validateAssetDelete,
  deleteAsset,
} from "@/modules/inventario/services/asset-detail";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;
  try {
    const asset = await getAssetDetail(id);
    if (!asset) return notFound();
    return ok(asset);
  } catch (e) {
    return serverError("Error al obtener activo", e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageExpenses(session)) return forbidden();
  const { id } = await params;
  try {
    const existing = await getAssetDetail(id);
    if (!existing) return notFound();
    const body = await req.json();
    const parsed = assetPatchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const validation = await validateAssetPatch(id, existing, parsed.data);
    if (validation) return badRequest(validation.message);

    const updated = await updateAsset(id, buildAssetPatchData(parsed.data, session.user.id));
    return ok(updated);
  } catch (e) {
    return serverError("Error al actualizar activo", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageExpenses(session)) return forbidden();
  const { id } = await params;
  try {
    const validation = await validateAssetDelete(id);
    if (validation?.message === "NOT_FOUND") return notFound();
    if (validation) return badRequest(validation.message);

    const ipAddress =
      _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      _req.headers.get("x-real-ip") ??
      null;
    await deleteAsset(id, session.user.id, ipAddress);
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar activo", e);
  }
}
