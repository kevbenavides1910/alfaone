import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { deleteAuditProgramItem, updateAuditProgramItem } from "@/modules/sig";
import { updateAuditProgramItemSchema } from "@/modules/sig/validations/audit-program.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const PATCH = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando ítem del programa" },
  async ({ req, params }) => {
    const parsed = updateAuditProgramItemSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de ítem inválidos", parsed.error.flatten());
    try {
      return ok(await updateAuditProgramItem(paramId(await params), parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);

export const DELETE = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error eliminando ítem del programa" },
  async ({ params }) => {
    try {
      return ok(await deleteAuditProgramItem(paramId(await params)));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
