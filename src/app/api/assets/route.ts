import { NextRequest } from "next/server";
import type { AssetStatus } from "@prisma/client";
import { getSession, canManageInventarioSession } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { assetIntakeCreateSchema } from "@/modules/inventario/validations/asset.schema";
import {
  listAssets,
  validateAssetIntake,
  createAssetIntake,
} from "@/modules/inventario/services/assets";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const rows = await listAssets({
      status: searchParams.get("status") as AssetStatus | null,
      typeId: searchParams.get("typeId"),
      contractId: searchParams.get("contractId"),
      positionId: searchParams.get("positionId"),
      q: searchParams.get("q")?.trim() ?? null,
    });
    return ok(rows);
  } catch (e) {
    return serverError("Error al obtener activos", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageInventarioSession(session)) return forbidden();

  try {
    const body = await req.json();
    const parsed = assetIntakeCreateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const validation = await validateAssetIntake(parsed.data);
    if (validation) return badRequest(validation.message);

    const result = await createAssetIntake(parsed.data, session.user.id);
    return created({ count: result.length, assets: result });
  } catch (e) {
    return serverError("Error al crear activos", e);
  }
}
