import { apiHandler } from "@/lib/api/handler";
import { ok, badRequest, notFound } from "@/lib/api/response";
import { alarmCodeSchema } from "@/modules/monitoreo/validations/schemas";
import { getAlarmCode, updateAlarmCode, deleteAlarmCode } from "@/modules/monitoreo/services/catalogs-service";

export const PATCH = apiHandler(
  { permission: ["monitoreo.mantenimientos", "edit"], errorLabel: "Error al actualizar código" },
  async ({ req, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getAlarmCode(id)) return notFound("Código no encontrado");
    const parsed = alarmCodeSchema.partial().safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await updateAlarmCode(id, parsed.data));
  }
);

export const DELETE = apiHandler(
  { permission: ["monitoreo.mantenimientos", "admin"], errorLabel: "Error al eliminar código" },
  async ({ params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getAlarmCode(id)) return notFound("Código no encontrado");
    await deleteAlarmCode(id);
    return ok({ deleted: true });
  }
);
