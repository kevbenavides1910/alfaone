import { prisma } from "@/modules/core/db/prisma";
import type { AssetMovementActionInput } from "@/modules/inventario/validations/asset.schema";
import { assetMovementListInclude } from "./asset-includes";

export type MovementValidationError = { message: string };

export async function validateAndApplyAssetMovement(
  assetId: string,
  data: AssetMovementActionInput,
  createdById: string,
): Promise<
  | { ok: true; result: unknown; status: "created" }
  | { ok: false; error: MovementValidationError; notFound?: boolean }
> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return { ok: false, error: { message: "Activo no encontrado" }, notFound: true };

  if (data.action === "ASSIGN") {
    if (asset.status !== "IN_STOCK") {
      return { ok: false, error: { message: "Sólo se pueden asignar activos que estén en stock." } };
    }
    const position = await prisma.position.findUnique({ where: { id: data.toPositionId } });
    if (!position) return { ok: false, error: { message: "Puesto destino no existe" } };

    const previousAtPosition = await prisma.asset.findMany({
      where: {
        typeId: asset.typeId,
        currentPositionId: data.toPositionId,
        status: "ASSIGNED",
        NOT: { id: assetId },
      },
      select: { id: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      if (previousAtPosition.length > 0) {
        await tx.asset.updateMany({
          where: { id: { in: previousAtPosition.map((p) => p.id) } },
          data: { status: "PENDING_RETURN" },
        });
      }
      const mv = await tx.assetMovement.create({
        data: {
          assetId,
          type: "ASSIGN",
          toPositionId: data.toPositionId,
          notes: data.notes?.trim() || null,
          createdById,
        },
      });
      await tx.asset.update({
        where: { id: assetId },
        data: { status: "ASSIGNED", currentPositionId: data.toPositionId },
      });
      return { mv, displaced: previousAtPosition.length };
    });

    return { ok: true, result: { id: result.mv.id, displaced: result.displaced }, status: "created" };
  }

  if (data.action === "RETURN") {
    const isAssigned = asset.status === "ASSIGNED";
    const isPendingReturn = asset.status === "PENDING_RETURN";
    if ((!isAssigned && !isPendingReturn) || !asset.currentPositionId) {
      return {
        ok: false,
        error: { message: "El activo no está asignado ni pendiente de devolución." },
      };
    }
    const fromPositionId = asset.currentPositionId;
    const result = await prisma.$transaction(async (tx) => {
      const mv = await tx.assetMovement.create({
        data: {
          assetId,
          type: "RETURN",
          fromPositionId,
          notes: data.notes?.trim() || null,
          createdById,
        },
      });
      await tx.asset.update({
        where: { id: assetId },
        data: { status: "IN_STOCK", currentPositionId: null },
      });
      return mv;
    });
    return { ok: true, result, status: "created" };
  }

  if (data.action === "ISSUE") {
    if (asset.status === "ASSIGNED") {
      return {
        ok: false,
        error: { message: "Devuelva primero el activo al stock antes de darlo de baja." },
      };
    }
    if (asset.status === "RETIRED") {
      return { ok: false, error: { message: "El activo ya está dado de baja." } };
    }
    const result = await prisma.$transaction(async (tx) => {
      const mv = await tx.assetMovement.create({
        data: {
          assetId,
          type: "ISSUE",
          issueReason: data.reason,
          notes: data.notes?.trim() || null,
          createdById,
        },
      });
      await tx.asset.update({
        where: { id: assetId },
        data: { status: "RETIRED" },
      });
      return mv;
    });
    return { ok: true, result, status: "created" };
  }

  return { ok: false, error: { message: "Acción desconocida" } };
}

export async function listMovementsForAsset(assetId: string) {
  return prisma.assetMovement.findMany({
    where: { assetId },
    orderBy: { createdAt: "desc" },
    include: assetMovementListInclude,
  });
}
