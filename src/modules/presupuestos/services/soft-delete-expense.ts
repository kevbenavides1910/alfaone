import type { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/modules/core/audit/write-audit-log";

export type SoftDeleteExpenseResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND"; message: string };

/**
 * Soft-delete de un gasto: marca deletedAt sin borrar físicamente el registro.
 * El historial de aprobaciones, distribuciones y adjuntos permanece intacto.
 *
 * Usar `dbForSession(session)` como cliente para garantizar aislamiento multi-tenant.
 */
export async function softDeleteExpense(
  db: PrismaClient,
  id: string,
  deletedById: string,
  ipAddress?: string | null,
): Promise<SoftDeleteExpenseResult> {
  const expense = await db.expense.findUnique({ where: { id } });
  if (!expense || expense.deletedAt) {
    return { ok: false, code: "NOT_FOUND", message: "Gasto no encontrado" };
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById },
    });

    await writeAuditLog(tx, {
      userId: deletedById,
      entityType: "expense",
      entityId: id,
      action: "SOFT_DELETE",
      previousData: expense,
      newData: updated,
      contractId: expense.contractId,
      ipAddress,
    });
  });

  return { ok: true };
}
