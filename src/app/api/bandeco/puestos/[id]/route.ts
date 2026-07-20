import { apiHandler } from "@/lib/api/handler";
import { ok, badRequest, notFound } from "@/lib/api/response";
import { puestoSchema } from "@/modules/bandeco/validations/schemas";
import { getPuesto, updatePuesto, deletePuesto } from "@/modules/bandeco/services/catalogs-service";

export const PATCH = apiHandler(
  { permission: ["bandeco.mantenimientos", "edit"], errorLabel: "Error al actualizar puesto" },
  async ({ req, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getPuesto(id)) return notFound("Puesto no encontrado");
    const parsed = puestoSchema.partial().safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await updatePuesto(id, parsed.data));
  }
);

export const DELETE = apiHandler(
  { permission: ["bandeco.mantenimientos", "admin"], errorLabel: "Error al eliminar puesto" },
  async ({ params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getPuesto(id)) return notFound("Puesto no encontrado");
    await deletePuesto(id);
    return ok({ deleted: true });
  }
);
