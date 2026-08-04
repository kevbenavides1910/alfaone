import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api/response";
import { getSigProcessDossier } from "@/modules/sig";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !hasPermission(session, "sig.procesos", "view") &&
    !hasPermission(session, "sig.biblioteca", "view") &&
    !hasPermission(session, "sig.requisitos", "view")
  ) {
    return forbidden();
  }

  try {
    const { id } = await ctx.params;
    const dossier = await getSigProcessDossier(id);
    if (!dossier) return notFound("Proceso no encontrado");
    return ok(dossier);
  } catch (e) {
    return serverError("Error cargando expediente de proceso", e);
  }
}
