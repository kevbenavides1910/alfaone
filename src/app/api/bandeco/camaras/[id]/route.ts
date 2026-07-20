import { apiHandler } from "@/lib/api/handler";
import { ok, badRequest, notFound } from "@/lib/api/response";
import { camaraSchema } from "@/modules/bandeco/validations/schemas";
import { getCamara, updateCamara, deleteCamara } from "@/modules/bandeco/services/catalogs-service";

export const PATCH = apiHandler(
  { permission: ["bandeco.mantenimientos", "edit"], errorLabel: "Error al actualizar cámara" },
  async ({ req, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getCamara(id)) return notFound("Cámara no encontrada");
    const parsed = camaraSchema.partial().safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await updateCamara(id, parsed.data));
  }
);

export const DELETE = apiHandler(
  { permission: ["bandeco.mantenimientos", "admin"], errorLabel: "Error al eliminar cámara" },
  async ({ params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getCamara(id)) return notFound("Cámara no encontrada");
    await deleteCamara(id);
    return ok({ deleted: true });
  }
);
