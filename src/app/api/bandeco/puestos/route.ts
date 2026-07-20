import { apiHandler } from "@/lib/api/handler";
import { ok, created, badRequest } from "@/lib/api/response";
import { puestoSchema } from "@/modules/bandeco/validations/schemas";
import { listPuestos, createPuesto } from "@/modules/bandeco/services/catalogs-service";

export const GET = apiHandler(
  { permission: ["bandeco.mantenimientos", "view"], errorLabel: "Error al listar puestos" },
  async () => ok(await listPuestos())
);

export const POST = apiHandler(
  { permission: ["bandeco.mantenimientos", "edit"], errorLabel: "Error al crear puesto" },
  async ({ req }) => {
    const parsed = puestoSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return created(await createPuesto(parsed.data));
  }
);
