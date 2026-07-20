import { apiHandler } from "@/lib/api/handler";
import { ok, badRequest, notFound } from "@/lib/api/response";
import { alarmCodeSchema } from "@/modules/bandeco/validations/schemas";
import { getAlarmCode, updateAlarmCode, deleteAlarmCode } from "@/modules/bandeco/services/catalogs-service";

export const PATCH = apiHandler(
  { permission: ["bandeco.mantenimientos", "edit"], errorLabel: "Error al actualizar código" },
  async ({ req, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getAlarmCode(id)) return notFound("Código no encontrado");
    const parsed = alarmCodeSchema.partial().safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await updateAlarmCode(id, parsed.data));
  }
);

export const DELETE = apiHandler(
  { permission: ["bandeco.mantenimientos", "admin"], errorLabel: "Error al eliminar código" },
  async ({ params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!await getAlarmCode(id)) return notFound("Código no encontrado");
    await deleteAlarmCode(id);
    return ok({ deleted: true });
  }
);
