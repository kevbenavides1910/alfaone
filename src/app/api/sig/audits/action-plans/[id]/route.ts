import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { updateActionPlan } from "@/modules/sig";
import { updateActionPlanSchema } from "@/modules/sig/validations/audits.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const PATCH = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando plan de acción SIG" },
  async ({ req, params }) => {
    const parsed = updateActionPlanSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de plan de acción inválidos", parsed.error.flatten());
    return ok(await updateActionPlan(paramId(await params), parsed.data));
  }
);
