import { apiHandler } from "@/lib/api/handler";
import { ok, created, badRequest } from "@/lib/api/response";
import { camaraSchema } from "@/modules/monitoreo/validations/schemas";
import { listCamaras, createCamara } from "@/modules/monitoreo/services/catalogs-service";

export const GET = apiHandler(
  { permission: ["monitoreo.mantenimientos", "view"], errorLabel: "Error al listar cámaras" },
  async ({ req }) => {
    const pantalla = req.nextUrl.searchParams.get("pantalla");
    return ok(await listCamaras(pantalla ? Number(pantalla) : null));
  }
);

export const POST = apiHandler(
  { permission: ["monitoreo.mantenimientos", "edit"], errorLabel: "Error al crear cámara" },
  async ({ req }) => {
    const parsed = camaraSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return created(await createCamara(parsed.data));
  }
);
