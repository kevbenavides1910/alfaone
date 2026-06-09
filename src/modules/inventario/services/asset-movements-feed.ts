import type { AssetMovementType, Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { assetMovementFeedInclude } from "./asset-includes";

export type AssetMovementFeedFilters = {
  type?: AssetMovementType | null;
  typeId?: string | null;
  assetId?: string | null;
  limit?: number;
};

export async function listAssetMovementsFeed(filters: AssetMovementFeedFilters) {
  const limit = Math.min(filters.limit ?? 200, 500);
  const where: Prisma.AssetMovementWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.assetId) where.assetId = filters.assetId;
  if (filters.typeId) where.asset = { typeId: filters.typeId };

  return prisma.assetMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: assetMovementFeedInclude,
  });
}
