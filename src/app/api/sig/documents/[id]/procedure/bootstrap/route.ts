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
import { bootstrapProcedureFromExtractedText } from "@/modules/sig/services/procedure-content";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.documentos", "edit")) return forbidden();

  const { id } = await params;
  try {
    const data = await bootstrapProcedureFromExtractedText(id, session.user.id);
    if (!data) return notFound("Documento no encontrado");
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al convertir";
    if (
      msg.includes("texto") ||
      msg.includes("estructurado") ||
      msg.includes("obsoleto") ||
      msg.includes("versión") ||
      msg.includes("no encontrado")
    ) {
      return badRequest(msg);
    }
    return serverError("Error al convertir texto a procedimiento", e);
  }
}
