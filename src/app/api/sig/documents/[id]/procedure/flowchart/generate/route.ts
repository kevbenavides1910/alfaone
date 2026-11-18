import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/response";
import { regenerateFlowchart } from "@/modules/sig/services/flowchart-generator";
import { assertCanEditSigDocument } from "@/modules/sig/services/process-editors";
import { prisma } from "@/modules/core/db/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

  const { id } = await params;
  try {
    const docMeta = await prisma.sigDocument.findUnique({
      where: { id },
      select: { processId: true },
    });
    if (!docMeta) return notFound("Documento no encontrado");
    try {
      await assertCanEditSigDocument(session, docMeta.processId);
    } catch (e) {
      return forbidden(e instanceof Error ? e.message : "Sin permiso de edición");
    }

    const result = await regenerateFlowchart(id);
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al generar diagrama";
    if (
      msg.includes("obsoleto") ||
      msg.includes("no encontrado") ||
      msg.includes("versión") ||
      msg.includes("actividades")
    ) {
      return badRequest(msg);
    }
    return serverError("Error al generar diagrama de flujo", e);
  }
}
