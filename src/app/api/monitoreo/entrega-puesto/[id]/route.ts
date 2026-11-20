import { apiHandler } from "@/lib/api/handler";
import { ok, notFound } from "@/lib/api/response";
import { eliminarEntregaPuesto } from "@/modules/monitoreo/services/entrega-puesto";

export const DELETE = apiHandler(
  { permission: ["monitoreo.operacion", "edit"], errorLabel: "Error al eliminar entrega de puesto" },
  async ({ params }) => {
    const { id } = await params;
    const removed = await eliminarEntregaPuesto(String(id));
    if (!removed) return notFound("Entrega no encontrada");
    return ok({ deleted: true });
  },
);
