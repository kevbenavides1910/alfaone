import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { getProcedureFlowchart } from "@/modules/sig/services/procedure-content";
import { SIG_DOCUMENTS_ROOT } from "@/modules/sig/services/document-uploads";
import { resolveUnderRoot } from "@/lib/security/path-safety";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id } = await params;
  try {
    const file = await getProcedureFlowchart(id);
    if (!file) return notFound("Sin diagrama de flujo");

    const abs = resolveUnderRoot(SIG_DOCUMENTS_ROOT, file.storagePath);
    if (!abs) return notFound();

    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound();

    return new Response(buf, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return serverError("Error al servir diagrama", e);
  }
}
