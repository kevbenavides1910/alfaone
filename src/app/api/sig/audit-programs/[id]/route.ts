import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import {
  approveAuditProgram,
  getAuditProgramDetail,
  refreshAuditProgramPriorities,
  updateAuditProgram,
} from "@/modules/sig";
import { updateAuditProgramSchema } from "@/modules/sig/validations/audit-program.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.auditorias", "view"], errorLabel: "Error consultando programa de auditoría" },
  async ({ params }) => {
    const row = await getAuditProgramDetail(paramId(await params));
    if (!row) return notFound("Programa no encontrado");
    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error actualizando programa de auditoría" },
  async ({ req, params, session }) => {
    const id = paramId(await params);
    const body = await req.json();
    const action = body?.action as string | undefined;

    try {
      if (action === "approve") {
        return ok(await approveAuditProgram(id, sessionUserId(session)));
      }
      if (action === "refreshPriorities") {
        return ok(await refreshAuditProgramPriorities(id));
      }

      const parsed = updateAuditProgramSchema.safeParse(body);
      if (!parsed.success) return badRequest("Datos de programa inválidos", parsed.error.flatten());
      return ok(await updateAuditProgram(id, parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
