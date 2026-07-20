import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { updateChecklistItem } from "@/modules/sig";
import { updateChecklistItemSchema } from "@/modules/sig/validations/audits.schema";

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
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando etapa de checklist SIG" },
  async ({ req, params, session }) => {
    const parsed = updateChecklistItemSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de checklist inválidos", parsed.error.flatten());
    return ok(await updateChecklistItem(paramId(await params), { ...parsed.data, reviewedById: sessionUserId(session) }));
  }
);
