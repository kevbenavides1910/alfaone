import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok, created, badRequest } from "@/lib/api/response";
import { alarmCodeSchema } from "@/modules/monitoreo/validations/schemas";
import { listAlarmCodes, createAlarmCode } from "@/modules/monitoreo/services/catalogs-service";

export const GET = apiHandler(
  { permission: ["monitoreo.mantenimientos", "view"], errorLabel: "Error al listar códigos de alarma" },
  async ({ req }) => ok(await listAlarmCodes(req.nextUrl.searchParams.get("q")))
);

export const POST = apiHandler(
  { permission: ["monitoreo.mantenimientos", "edit"], errorLabel: "Error al crear código de alarma" },
  async ({ req }) => {
    const parsed = alarmCodeSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return created(await createAlarmCode(parsed.data));
  }
);
