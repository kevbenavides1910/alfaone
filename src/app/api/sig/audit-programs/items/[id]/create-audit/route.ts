import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createAuditFromProgramItem } from "@/modules/sig";
import { createAuditFromProgramItemSchema } from "@/modules/sig/validations/audit-program.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const POST = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error creando auditoría desde el programa" },
  async ({ req, params, session }) => {
    const body = await req.json().catch(() => ({}));
    const parsed = createAuditFromProgramItemSchema.safeParse(body ?? {});
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    try {
      const result = await createAuditFromProgramItem(paramId(await params), {
        ...parsed.data,
        createdById: sessionUserId(session),
      });
      return result.reused ? ok(result) : created(result);
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
