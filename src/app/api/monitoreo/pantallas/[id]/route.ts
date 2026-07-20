import { apiHandler } from "@/lib/api/handler";
import { ok, badRequest, notFound } from "@/lib/api/response";
import { pantallaSchema } from "@/modules/monitoreo/validations/schemas";
import { getPantalla, updatePantalla, deletePantalla } from "@/modules/monitoreo/services/catalogs-service";

export const PATCH = apiHandler(
  { permission: ["monitoreo.mantenimientos", "edit"], errorLabel: "Error al actualizar pantalla" },
  async ({ req, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getPantalla(id)) return notFound("Pantalla no encontrada");
    const parsed = pantallaSchema.partial().safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await updatePantalla(id, parsed.data));
  }
);

export const DELETE = apiHandler(
  { permission: ["monitoreo.mantenimientos", "admin"], errorLabel: "Error al eliminar pantalla" },
  async ({ params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getPantalla(id)) return notFound("Pantalla no encontrada");
    await deletePantalla(id);
    return ok({ deleted: true });
  }
);
