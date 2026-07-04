import { ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { prisma } from "@/modules/core/db/prisma";

type Params = { locationId: string };

export const GET = withPermission<Params>(async (_req, { params }) => {
  try {
    const positions = await prisma.position.findMany({
      where: { locationId: params.locationId },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, description: true },
    });
    return ok(positions);
  } catch (e) {
    return serverError("Error al listar puestos", e);
  }
}, "recorridos.rutas", "view");
