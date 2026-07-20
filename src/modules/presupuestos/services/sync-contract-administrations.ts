import type { PrismaClient } from "@prisma/client";

type AdminSyncDb = Pick<PrismaClient, "contractAdministration">;

/** Asegura que existan exactamente `count` filas de administración para el contrato. */
export async function syncContractAdministrations(
  prisma: AdminSyncDb,
  contractId: string,
  count: number,
  createdById?: string
) {
  const safeCount = Math.max(1, Math.min(20, count));
  const existing = await prisma.contractAdministration.findMany({
    where: { contractId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (existing.length < safeCount) {
    const toCreate = safeCount - existing.length;
    const startOrder = existing.length;
    for (let i = 0; i < toCreate; i++) {
      const order = startOrder + i;
      await prisma.contractAdministration.create({
        data: {
          contractId,
          name: `Administración ${order + 1}`,
          managerName: "",
          sortOrder: order,
          createdById: createdById ?? null,
        },
      });
    }
  } else if (existing.length > safeCount) {
    const toRemove = existing.slice(safeCount);
    const removeIds = toRemove.map((r) => r.id);
    await prisma.contractAdministration.deleteMany({
      where: { id: { in: removeIds } },
    });
  }
}
