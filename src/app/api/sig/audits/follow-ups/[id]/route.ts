import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { updateFollowUp } from "@/modules/sig";
import { updateFollowUpSchema } from "@/modules/sig/validations/audits.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const PATCH = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando seguimiento SIG" },
  async ({ req, params }) => {
    const parsed = updateFollowUpSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de seguimiento inválidos", parsed.error.flatten());
    return ok(await updateFollowUp(paramId(await params), parsed.data));
  }
);
