import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type { AssetPatchInput } from "@/modules/inventario/validations/asset.schema";
import { assetDetailInclude } from "./asset-includes";

export async function getAssetDetail(id: string) {
  return prisma.asset.findUnique({
    where: { id },
    include: assetDetailInclude,
  });
}

export type AssetUpdateValidationError = { message: string };

export async function validateAssetPatch(
  id: string,
  existing: { typeId: string; code: string },
  data: AssetPatchInput,
): Promise<AssetUpdateValidationError | null> {
  if (data.code && data.code !== existing.code) {
    const dup = await prisma.asset.findFirst({
      where: { typeId: existing.typeId, code: data.code, id: { not: id } },
    });
    if (dup) return { message: "Ya existe otro activo con ese código para este tipo" };
  }

  if (data.acquisitionExpenseId) {
    const exp = await prisma.expense.findUnique({ where: { id: data.acquisitionExpenseId } });
    if (!exp) return { message: "Gasto / OC referenciado no existe" };
  }

  return null;
}

export function buildAssetPatchData(parsed: AssetPatchInput): Prisma.AssetUpdateInput {
  const data: Prisma.AssetUpdateInput = {};
  if (parsed.code !== undefined) data.code = parsed.code.trim();
  if (parsed.name !== undefined) data.name = parsed.name?.trim() || null;
  if (parsed.brand !== undefined) data.brand = parsed.brand?.trim() || null;
  if (parsed.model !== undefined) data.model = parsed.model?.trim() || null;
  if (parsed.attributes !== undefined) data.attributes = parsed.attributes as Prisma.InputJsonValue;
  if (parsed.acquisitionExpenseId !== undefined) {
    data.acquisitionExpense = parsed.acquisitionExpenseId
      ? { connect: { id: parsed.acquisitionExpenseId } }
      : { disconnect: true };
  }
  if (parsed.acquisitionDate !== undefined) {
    data.acquisitionDate = parsed.acquisitionDate ? new Date(parsed.acquisitionDate) : null;
  }
  if (parsed.notes !== undefined) data.notes = parsed.notes?.trim() || null;
  return data;
}

export async function updateAsset(id: string, data: Prisma.AssetUpdateInput) {
  return prisma.asset.update({ where: { id }, data });
}

export type AssetDeleteValidationError = { message: string };

export async function validateAssetDelete(id: string): Promise<AssetDeleteValidationError | null> {
  const existing = await prisma.asset.findUnique({
    where: { id },
    include: { _count: { select: { movements: true } } },
  });
  if (!existing) return { message: "NOT_FOUND" };
  if (existing.status !== "IN_STOCK") {
    return { message: "No se puede eliminar: el activo debe estar en stock (no asignado)." };
  }
  if (existing._count.movements > 1) {
    return {
      message:
        "No se puede eliminar: el activo tiene historial de movimientos. Dele de baja (Salida) en su lugar.",
    };
  }
  return null;
}

export async function deleteAsset(id: string) {
  await prisma.$transaction([
    prisma.assetMovement.deleteMany({ where: { assetId: id } }),
    prisma.asset.delete({ where: { id } }),
  ]);
}
