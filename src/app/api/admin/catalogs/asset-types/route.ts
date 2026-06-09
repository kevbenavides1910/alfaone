import { NextRequest } from "next/server";
import { getSession, canManageCatalogsSession } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { assetTypeCreateSchema } from "@/modules/inventario/validations/asset-type.schema";
import { listAssetTypes, createAssetType } from "@/modules/inventario/services/asset-types";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  try {
    const rows = await listAssetTypes();
    return ok(rows);
  } catch (e) {
    return serverError("Error al obtener tipos de activos", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageCatalogsSession(session)) return forbidden();
  try {
    const body = await req.json();
    const parsed = assetTypeCreateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await createAssetType(parsed.data);
    if (!result.ok) return badRequest(result.message);
    return created(result.row);
  } catch (e) {
    return serverError("Error al crear tipo de activo", e);
  }
}
