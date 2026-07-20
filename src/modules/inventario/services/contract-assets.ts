import { prisma } from "@/modules/core/db/prisma";

export async function getContractAssetsTree(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, licitacionNo: true, client: true },
  });
  if (!contract) return null;

  const locations = await prisma.contractLocation.findMany({
    where: { contractId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      positions: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          shifts: { orderBy: { sortOrder: "asc" } },
          assets: {
            where: { status: "ASSIGNED", deletedAt: null },
            include: { type: true },
            orderBy: [{ updatedAt: "desc" }],
          },
        },
      },
    },
  });

  return { contract, locations };
}
