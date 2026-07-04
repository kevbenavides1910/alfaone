import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { getSubmissionById } from "@/modules/formularios/services/submissions";

type Ctx = { params: Promise<{ id: string; submissionId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "formularios.resultados", "view")) return forbidden();

  const { id: formId, submissionId } = await ctx.params;

  try {
    const row = await getSubmissionById(submissionId);
    if (!row || row.formId !== formId) return badRequest("Envío no encontrado");

    return ok({
      ...row,
      submittedAt: row.submittedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al obtener detalle del envío", e);
  }
}
