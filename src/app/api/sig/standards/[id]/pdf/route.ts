import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api/response";
import { getSigStandardPdf, uploadSigStandardPdf } from "@/modules/sig";

type Ctx = { params: Promise<{ id: string }> };

function canView(session: Parameters<typeof hasPermission>[0]) {
  return (
    hasPermission(session, "sig.requisitos", "view") ||
    hasPermission(session, "sig.biblioteca", "view") ||
    hasPermission(session, "sig.auditorias", "view")
  );
}

function canEdit(session: Parameters<typeof hasPermission>[0]) {
  return (
    hasPermission(session, "sig.requisitos", "edit") ||
    hasPermission(session, "sig.documentos", "edit") ||
    hasPermission(session, "sig.biblioteca", "edit")
  );
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canView(session)) return forbidden();

  try {
    const { id } = await params;
    const pdf = await getSigStandardPdf(id);
    if (!pdf) {
      return notFound(
        "Aún no hay PDF de esta norma. Súbalo con el botón «Subir PDF» (copia licenciada de la organización)."
      );
    }

    const inline = req.nextUrl.searchParams.get("inline") !== "0";
    const disposition = inline ? "inline" : "attachment";
    return new Response(new Uint8Array(pdf.buffer), {
      headers: {
        "Content-Type": pdf.mimeType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(pdf.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
        // Permite iframe same-origin (el DENY global de next.config lo anula vía headers() de esta ruta).
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
      },
    });
  } catch (e) {
    return serverError("Error descargando PDF de la norma", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canEdit(session)) return forbidden();

  try {
    const { id } = await params;
    const form = await req.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File) || !uploaded.size) {
      return badRequest("Seleccione el PDF de la norma");
    }
    const buffer = Buffer.from(await uploaded.arrayBuffer());
    const result = await uploadSigStandardPdf(id, {
      buffer,
      fileName: uploaded.name || "norma.pdf",
      mimeType: uploaded.type || "application/pdf",
    });
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error subiendo PDF";
    if (
      message.includes("Solo se acepta") ||
      message.includes("demasiado grande") ||
      message.includes("no parece") ||
      message.includes("no encontrada")
    ) {
      return badRequest(message);
    }
    return serverError("Error subiendo PDF de la norma", e);
  }
}
