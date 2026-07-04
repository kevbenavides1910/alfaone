import { prisma } from "@/modules/core/db/prisma";

export async function getNafEmployeeBySourceKey(sourceKey: string) {
  return prisma.nafEmployee.findUnique({
    where: { sourceKey },
  });
}
