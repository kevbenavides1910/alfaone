import { prisma } from "@/modules/core/db/prisma";
import type {
  AssetTypeCreateInput,
  AssetTypePatchInput,
} from "@/modules/inventario/validations/asset-type.schema";

export async function listAssetTypes() {
  return prisma.assetType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createAssetType(
  data: AssetTypeCreateInput,
): Promise<{ ok: true; row: Awaited<ReturnType<typeof prisma.assetType.create>> } | { ok: false; message: string }> {
  const existing = await prisma.assetType.findUnique({ where: { code: data.code } });
  if (existing) return { ok: false, message: "Ya existe un tipo con ese código" };

  const row = await prisma.assetType.create({
    data: {
      code: data.code,
      name: data.name,
      fields: data.fields,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });
  return { ok: true, row };
}

export async function updateAssetType(
  id: string,
  data: AssetTypePatchInput,
): Promise<
  | { ok: true; row: Awaited<ReturnType<typeof prisma.assetType.update>> }
  | { ok: false; reason: "not_found" }
> {
  const existing = await prisma.assetType.findUnique({ where: { id } });
  if (!existing) return { ok: false, reason: "not_found" };

  const row = await prisma.assetType.update({
    where: { id },
    data,
  });
  return { ok: true, row };
}

export async function deleteAssetType(
  id: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "has_assets"; message: string }
> {
  const existing = await prisma.assetType.findUnique({
    where: { id },
    include: { _count: { select: { assets: true } } },
  });
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing._count.assets > 0) {
    return {
      ok: false,
      reason: "has_assets",
      message: `No se puede eliminar: tiene ${existing._count.assets} activo(s) asociados.`,
    };
  }
  await prisma.assetType.delete({ where: { id } });
  return { ok: true };
}
