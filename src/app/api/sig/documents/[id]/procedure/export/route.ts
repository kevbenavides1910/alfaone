import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { getSigProcedureContent } from "@/modules/sig/services/procedure-content";
import { buildProcedureAlfaPdf } from "@/modules/sig/services/procedure-export-pdf";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.biblioteca", "view")) return forbidden();

  const { id } = await params;
  try {
    const view = await getSigProcedureContent(id);
    if (!view) return notFound("Documento no encontrado");
    if (!view.showAsProcedure && !view.hasStructuredContent && !view.extractedText) {
      return notFound("Sin contenido de procedimiento para exportar");
    }

    const bytes = await buildProcedureAlfaPdf(view);
    const filename = `${view.code || "procedimiento"}-v${view.versionLabel || "0"}-alfa.pdf`.replace(
      /[^\w.\-]+/g,
      "_"
    );

    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return serverError("Error al exportar procedimiento PDF", e);
  }
}
