import { apiHandler } from "@/lib/api/handler";
import { ok, created, badRequest } from "@/lib/api/response";
import { puestoSchema } from "@/modules/monitoreo/validations/schemas";
import { listPuestos, createPuesto } from "@/modules/monitoreo/services/catalogs-service";

export const GET = apiHandler(
  { permission: ["monitoreo.mantenimientos", "view"], errorLabel: "Error al listar puestos" },
  async () => ok(await listPuestos())
);

export const POST = apiHandler(
  { permission: ["monitoreo.mantenimientos", "edit"], errorLabel: "Error al crear puesto" },
  async ({ req }) => {
    const parsed = puestoSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return created(await createPuesto(parsed.data));
  }
);
