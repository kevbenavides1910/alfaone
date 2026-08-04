import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createAuditSample } from "@/modules/sig";
import { createSampleSchema } from "@/modules/sig/validations/audits.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const POST = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error creando muestra de auditoría" },
  async ({ req, params }) => {
    const parsed = createSampleSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de muestra inválidos", parsed.error.flatten());
    return created(await createAuditSample({ ...parsed.data, auditId: paramId(await params) }));
  }
);
