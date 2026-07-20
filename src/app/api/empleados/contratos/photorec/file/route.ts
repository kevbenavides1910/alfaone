import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { unauthorized, forbidden, badRequest, notFound, serverError } from "@/lib/api/response";
import { readPhotorecPdf } from "@/modules/empleados/services/photorec-review";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "view")) return forbidden();

  try {
    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) return badRequest("Requiere id");
    const file = await readPhotorecPdf(id);
    if (!file) return notFound("PDF no encontrado");

    return new Response(new Uint8Array(file.buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
      },
    });
  } catch (e) {
    return serverError("Error al leer PDF PhotoRec", e);
  }
}
