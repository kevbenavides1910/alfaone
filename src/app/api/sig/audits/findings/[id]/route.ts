import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { updateFinding } from "@/modules/sig";
import { updateFindingSchema } from "@/modules/sig/validations/audits.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const PATCH = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando hallazgo SIG" },
  async ({ req, params }) => {
    const parsed = updateFindingSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de hallazgo inválidos", parsed.error.flatten());
    try {
      return ok(await updateFinding(paramId(await params), parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
