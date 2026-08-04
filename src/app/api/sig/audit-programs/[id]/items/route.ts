import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createAuditProgramItem } from "@/modules/sig";
import { createAuditProgramItemSchema } from "@/modules/sig/validations/audit-program.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const POST = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error creando ítem del programa" },
  async ({ req, params }) => {
    const parsed = createAuditProgramItemSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de ítem inválidos", parsed.error.flatten());
    try {
      return created(await createAuditProgramItem(paramId(await params), parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
