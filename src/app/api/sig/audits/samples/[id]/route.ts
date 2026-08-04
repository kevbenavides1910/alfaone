import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { updateAuditSample } from "@/modules/sig";
import { updateSampleSchema } from "@/modules/sig/validations/audits.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const PATCH = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando muestra de auditoría" },
  async ({ req, params }) => {
    const parsed = updateSampleSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de muestra inválidos", parsed.error.flatten());
    return ok(await updateAuditSample(paramId(await params), parsed.data));
  }
);
