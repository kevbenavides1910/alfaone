import { apiHandler } from "@/lib/api/handler";
import { ok, created, badRequest } from "@/lib/api/response";
import { entregaPuestoSchema } from "@/modules/monitoreo/validations/schemas";
import { crearEntregaPuesto, listEntregasPuesto } from "@/modules/monitoreo/services/entrega-puesto";

export const GET = apiHandler(
  { permission: ["monitoreo.operacion", "view"], errorLabel: "Error al listar entregas de puesto" },
  async ({ req }) => {
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "200");
    const desde = req.nextUrl.searchParams.get("desde") ?? undefined;
    const hasta = req.nextUrl.searchParams.get("hasta") ?? undefined;
    const rows = await listEntregasPuesto({
      limit: Number.isFinite(limit) ? limit : 200,
      desde: desde || undefined,
      hasta: hasta || undefined,
    });
    return ok(rows);
  },
);

export const POST = apiHandler(
  { permission: ["monitoreo.operacion", "edit"], errorLabel: "Error al guardar entrega de puesto" },
  async ({ req, session }) => {
    const parsed = entregaPuestoSchema.safeParse(await req.json());
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Datos inválidos";
      return badRequest(message, parsed.error.flatten());
    }
    const { row } = await crearEntregaPuesto({
      ...parsed.data,
      createdById: session.user.id ?? null,
      createdByName: session.user.name ?? session.user.email ?? "Operador",
    });
    return created(row);
  },
);
