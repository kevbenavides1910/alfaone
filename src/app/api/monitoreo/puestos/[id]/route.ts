import { apiHandler } from "@/lib/api/handler";
import { ok, badRequest, notFound } from "@/lib/api/response";
import { puestoSchema } from "@/modules/monitoreo/validations/schemas";
import { getPuesto, updatePuesto, deletePuesto } from "@/modules/monitoreo/services/catalogs-service";

export const PATCH = apiHandler(
  { permission: ["monitoreo.mantenimientos", "edit"], errorLabel: "Error al actualizar puesto" },
  async ({ req, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getPuesto(id)) return notFound("Puesto no encontrado");
    const parsed = puestoSchema.partial().safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await updatePuesto(id, parsed.data));
  }
);

export const DELETE = apiHandler(
  { permission: ["monitoreo.mantenimientos", "admin"], errorLabel: "Error al eliminar puesto" },
  async ({ params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getPuesto(id)) return notFound("Puesto no encontrado");
    await deletePuesto(id);
    return ok({ deleted: true });
  }
);
