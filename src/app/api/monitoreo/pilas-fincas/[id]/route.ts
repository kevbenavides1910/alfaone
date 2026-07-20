import { apiHandler } from "@/lib/api/handler";
import { ok, badRequest, notFound } from "@/lib/api/response";
import { pilaFincaSchema } from "@/modules/monitoreo/validations/schemas";
import { getPilaFinca, updatePilaFinca, deletePilaFinca } from "@/modules/monitoreo/services/catalogs-service";

export const PATCH = apiHandler(
  { permission: ["monitoreo.mantenimientos", "edit"], errorLabel: "Error al actualizar finca de pilas" },
  async ({ req, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getPilaFinca(id)) return notFound("Finca de pilas no encontrada");
    const parsed = pilaFincaSchema.partial().safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await updatePilaFinca(id, parsed.data));
  }
);

export const DELETE = apiHandler(
  { permission: ["monitoreo.mantenimientos", "admin"], errorLabel: "Error al eliminar finca de pilas" },
  async ({ params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getPilaFinca(id)) return notFound("Finca de pilas no encontrada");
    await deletePilaFinca(id);
    return ok({ deleted: true });
  }
);
