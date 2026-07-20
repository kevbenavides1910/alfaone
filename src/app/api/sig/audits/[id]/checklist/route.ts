import { apiHandler } from "@/lib/api/handler";
import { badRequest, created } from "@/lib/api/response";
import { createChecklistItem } from "@/modules/sig";
import { createChecklistItemSchema } from "@/modules/sig/validations/audits.schema";

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
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error creando etapa de checklist SIG" },
  async ({ req, params, session }) => {
    const parsed = createChecklistItemSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de checklist inválidos", parsed.error.flatten());
    return created(
      await createChecklistItem({
        ...parsed.data,
        auditId: paramId(await params),
        reviewedById: sessionUserId(session),
      })
    );
  }
);
