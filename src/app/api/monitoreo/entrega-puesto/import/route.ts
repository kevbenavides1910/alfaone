import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok, badRequest } from "@/lib/api/response";
import { entregaPuestoSchema } from "@/modules/monitoreo/validations/schemas";
import { importarEntregasPuesto } from "@/modules/monitoreo/services/entrega-puesto";

const backupSchema = z
  .array(
    z
      .object({
        id: z.string().min(1).max(80),
        created: z.string().max(40).optional(),
        fecha: z.string(),
        hora: z.string(),
        saliente: z.string(),
        entrante: z.string(),
        observaciones: z.string().optional().default(""),
        checks: z.array(
          z.object({
            group: z.string(),
            label: z.string(),
            status: z.string(),
          }),
        ),
      })
      .passthrough(),
  )
  .max(2000);

export const POST = apiHandler(
  { permission: ["monitoreo.operacion", "edit"], errorLabel: "Error al importar entregas de puesto" },
  async ({ req, session }) => {
    const wrapped = backupSchema.safeParse(await req.json());
    if (!wrapped.success) return badRequest("El respaldo no tiene el formato del checklist.");

    const parsed = [];
    for (const raw of wrapped.data) {
      const item = entregaPuestoSchema.safeParse({
        fecha: raw.fecha,
        hora: raw.hora,
        saliente: raw.saliente,
        entrante: raw.entrante,
        observaciones: raw.observaciones ?? "",
        checks: raw.checks,
        sourceId: raw.id,
        createdAt: raw.created,
      });
      if (!item.success) {
        return badRequest(item.error.issues[0]?.message ?? "Hay un registro que no se puede importar.");
      }
      parsed.push(item.data);
    }

    const result = await importarEntregasPuesto(parsed, {
      createdById: session.user.id ?? null,
      createdByName: session.user.name ?? session.user.email ?? "Operador",
    });
    return ok(result);
  },
);
