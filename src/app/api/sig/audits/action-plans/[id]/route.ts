import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { updateActionPlan } from "@/modules/sig";
import { updateActionPlanSchema } from "@/modules/sig/validations/audits.schema";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const PATCH = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando plan de acción SIG" },
  async ({ req, params, session }) => {
    const parsed = updateActionPlanSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de plan de acción inválidos", parsed.error.flatten());
    try {
      return ok(await updateActionPlan(paramId(await params), parsed.data, sessionUserId(session)));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
