import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import { getAuditDetail, updateAudit } from "@/modules/sig";
import { updateAuditSchema } from "@/modules/sig/validations/audits.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const GET = apiHandler(
  { permission: ["sig.auditorias", "view"], errorLabel: "Error obteniendo auditoría SIG" },
  async ({ params }) => {
    const audit = await getAuditDetail(paramId(await params));
    if (!audit) return notFound("Auditoría no encontrada");
    return ok(audit);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando auditoría SIG" },
  async ({ req, params }) => {
    const parsed = updateAuditSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de auditoría inválidos", parsed.error.flatten());
    return ok(await updateAudit(paramId(await params), parsed.data));
  }
);
