import { apiHandler } from "@/lib/api/handler";
import { badRequest, created } from "@/lib/api/response";
import { createActionPlan } from "@/modules/sig";
import { createActionPlanSchema } from "@/modules/sig/validations/audits.schema";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const POST = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error creando plan de acción SIG" },
  async ({ req, params, session }) => {
    const parsed = createActionPlanSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de plan de acción inválidos", parsed.error.flatten());
    return created(await createActionPlan({ ...parsed.data, findingId: paramId(await params), createdById: sessionUserId(session) }));
  }
);
