import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { prisma } from "@/modules/core/db/prisma";

type Params = { contractId: string };

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const locations = await prisma.contractLocation.findMany({
      where: { contractId: params.contractId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true },
    });
    return ok(locations);
  } catch (e) {
    return serverError("Error al listar ubicaciones", e);
  }
}, "recorridos.rutas", "view");
