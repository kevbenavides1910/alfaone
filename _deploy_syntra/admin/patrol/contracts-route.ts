import { prisma } from "@/modules/core/db/prisma";
import { ok } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";

export const GET = withPermission(async () => {
  const contracts = await prisma.contract.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ client: "asc" }, { licitacionNo: "asc" }],
    select: { id: true, licitacionNo: true, client: true, company: true },
  });
  return ok(contracts);
}, "recorridos.rutas", "view");
