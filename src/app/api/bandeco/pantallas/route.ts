import { apiHandler } from "@/lib/api/handler";
import { ok, created, badRequest } from "@/lib/api/response";
import { pantallaSchema } from "@/modules/bandeco/validations/schemas";
import { listPantallas, createPantalla } from "@/modules/bandeco/services/catalogs-service";

export const GET = apiHandler(
  { permission: ["bandeco.mantenimientos", "view"], errorLabel: "Error al listar pantallas" },
  async () => ok(await listPantallas())
);

export const POST = apiHandler(
  { permission: ["bandeco.mantenimientos", "edit"], errorLabel: "Error al crear pantalla" },
  async ({ req }) => {
    const parsed = pantallaSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return created(await createPantalla(parsed.data));
  }
);
