import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { getSigDocumentTraceability } from "@/modules/sig/services/document-traceability";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id } = await params;
  try {
    const data = await getSigDocumentTraceability(id);
    if (!data) return notFound();
    return ok({
      ...data,
      audits: data.audits.map((a) => ({
        ...a,
        scheduledDate: a.scheduledDate.toISOString(),
      })),
    });
  } catch (e) {
    return serverError("Error al obtener trazabilidad del documento", e);
  }
}
