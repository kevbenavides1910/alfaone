import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { unauthorized, forbidden, badRequest, serverError, notFound } from "@/lib/api/response";
import { downloadExpedienteDocumento } from "@/modules/expediente-digital";

type Ctx = { params: Promise<{ cedula: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "expedienteDigital.list", "view")) return forbidden();

  try {
    const { cedula: raw } = await context.params;
    const cedula = decodeURIComponent(raw || "").trim();
    const sp = req.nextUrl.searchParams;
    const tipoDoc = sp.get("tipoDoc")?.trim();
    const noEmple = sp.get("noEmple")?.trim();
    const nVersionRaw = sp.get("nVersion");
    const inline = sp.get("inline") === "1";

    if (!cedula || !tipoDoc || !noEmple) {
      return badRequest("Requiere tipoDoc y noEmple");
    }

    const nVersion = nVersionRaw ? Number.parseInt(nVersionRaw, 10) : null;
    const file = await downloadExpedienteDocumento({
      cedulaRaw: cedula,
      tipoDoc,
      noEmple,
      nVersion: Number.isFinite(nVersion) ? nVersion : null,
    });
    if (!file) return notFound("Archivo no encontrado en el share");

    return new Response(new Uint8Array(file.buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, no-store",
        // Permite iframe same-origin (previsualización). next.config también lo fija para esta ruta.
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/SMB del expediente no configurado/i.test(msg)) {
      return serverError(msg, e);
    }
    return serverError("Error al descargar documento", e);
  }
}
