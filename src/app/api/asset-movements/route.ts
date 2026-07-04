import { NextRequest } from "next/server";
import type { AssetMovementType } from "@prisma/client";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, serverError } from "@/lib/api/response";
import { listAssetMovementsFeed } from "@/modules/inventario/services/asset-movements-feed";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const rows = await listAssetMovementsFeed({
      type: searchParams.get("type") as AssetMovementType | null,
      typeId: searchParams.get("typeId"),
      assetId: searchParams.get("assetId"),
      limit: parseInt(searchParams.get("limit") ?? "200", 10),
    });
    return ok(rows);
  } catch (e) {
    return serverError("Error al obtener movimientos", e);
  }
}
