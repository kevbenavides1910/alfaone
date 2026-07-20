import type { AssetStatus, Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type { AssetIntakeCreateInput } from "@/modules/inventario/validations/asset.schema";
import { assetListInclude } from "./asset-includes";

export type AssetListFilters = {
  status?: AssetStatus | null;
  typeId?: string | null;
  contractId?: string | null;
  positionId?: string | null;
  q?: string | null;
};

export function buildAssetListWhere(filters: AssetListFilters): Prisma.AssetWhereInput {
  const where: Prisma.AssetWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.typeId) where.typeId = filters.typeId;
  if (filters.positionId) where.currentPositionId = filters.positionId;
  if (filters.contractId) where.currentPosition = { location: { contractId: filters.contractId } };
  if (filters.q) {
    where.OR = [
      { code: { contains: filters.q, mode: "insensitive" } },
      { name: { contains: filters.q, mode: "insensitive" } },
      { brand: { contains: filters.q, mode: "insensitive" } },
      { model: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  return where;
}

const ASSETS_DEFAULT_LIMIT = 200;
const ASSETS_MAX_LIMIT = 500;

export async function listAssets(filters: AssetListFilters & { limit?: number }) {
  const take = Math.min(filters.limit ?? ASSETS_DEFAULT_LIMIT, ASSETS_MAX_LIMIT);
  return prisma.asset.findMany({
    where: buildAssetListWhere(filters),
    include: assetListInclude,
    orderBy: [{ updatedAt: "desc" }],
    take,
  });
}

export type AssetIntakeValidationError = { message: string };

export async function validateAssetIntake(
  data: AssetIntakeCreateInput,
): Promise<AssetIntakeValidationError | null> {
  const type = await prisma.assetType.findUnique({ where: { id: data.typeId } });
  if (!type) return { message: "Tipo de activo no encontrado" };
  if (!type.isActive) return { message: "Tipo de activo inactivo" };

  if (data.expenseId) {
    const expense = await prisma.expense.findUnique({ where: { id: data.expenseId } });
    if (!expense) return { message: "Gasto / OC referenciado no existe" };
  }

  const typeFields = Array.isArray(type.fields)
    ? (type.fields as Array<{ key: string; required?: boolean; label?: string }>)
    : [];
  for (const item of data.items) {
    for (const f of typeFields) {
      if (f.required) {
        const v = item.attributes[f.key];
        if (v === undefined || v === null || v === "") {
          return { message: `Falta el campo "${f.label ?? f.key}" en el activo ${item.code}` };
        }
      }
    }
  }

  const codes = data.items.map((i) => i.code);
  const dupInBatch = codes.find((c, i) => codes.indexOf(c) !== i);
  if (dupInBatch) return { message: `Código duplicado en el lote: ${dupInBatch}` };

  const existing = await prisma.asset.findMany({
    where: { typeId: data.typeId, code: { in: codes }, deletedAt: null },
    select: { code: true },
  });
  if (existing.length > 0) {
    return {
      message: `Código(s) ya registrados para este tipo: ${existing.map((e) => e.code).join(", ")}`,
    };
  }

  return null;
}

export async function createAssetIntake(data: AssetIntakeCreateInput, createdById: string) {
  const acquisitionDate = data.acquisitionDate ? new Date(data.acquisitionDate) : new Date();

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const item of data.items) {
      const asset = await tx.asset.create({
        data: {
          typeId: data.typeId,
          code: item.code.trim(),
          name: item.name?.trim() || null,
          brand: item.brand?.trim() || null,
          model: item.model?.trim() || null,
          attributes: item.attributes as Prisma.InputJsonValue,
          status: "IN_STOCK",
          acquisitionExpenseId: data.expenseId || null,
          acquisitionDate,
          notes: data.notes?.trim() || null,
        },
      });
      await tx.assetMovement.create({
        data: {
          assetId: asset.id,
          type: "INTAKE",
          intakeReason: data.intakeReason,
          expenseId: data.expenseId || null,
          notes: data.notes?.trim() || null,
          createdById,
        },
      });
      created.push(asset);
    }
    return created;
  });
}
