import { prisma } from "@/modules/core/db/prisma";
import { ok, notFound, noContent, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";

type Params = { id: string };

export const DELETE = withPermission<Params>(async (_req, { params }) => {
  try {
    const existing = await prisma.patrolAssignment.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Asignación no encontrada");
    await prisma.patrolAssignment.delete({ where: { id: params.id } });
    return noContent();
  } catch (e) {
    return serverError("Error al eliminar asignación", e);
  }
}, "recorridos.asignaciones", "edit");
