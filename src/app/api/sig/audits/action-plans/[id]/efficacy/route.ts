import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { verifyActionPlanEfficacy } from "@/modules/sig";
import { verifyEfficacySchema } from "@/modules/sig/validations/audits.schema";

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
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error verificando eficacia" },
  async ({ req, params, session }) => {
    const parsed = verifyEfficacySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de verificación inválidos", parsed.error.flatten());
    try {
      return ok(
        await verifyActionPlanEfficacy({
          actionPlanId: paramId(await params),
          verifiedById: sessionUserId(session),
          ...parsed.data,
        })
      );
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
