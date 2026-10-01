import { readFile } from "fs/promises";
import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, noContent, notFound, serverError } from "@/lib/api/response";
import { LegalDocumentError } from "@/modules/documentos-legales/services/errors";
import {
  deleteLegalDocumentAttachment,
  getLegalDocumentAttachment,
} from "@/modules/documentos-legales/services/uploads";

type Ctx = { params: Promise<{ id: string; attachmentId: string }> };

function httpError(error: unknown, fallback: string) {
  if (error instanceof LegalDocumentError) {
    return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
  }
  return serverError(fallback, error);
}

export const GET = withPermission(async (req: NextRequest, ctx) => {
  try {
    const { att, abs } = await getLegalDocumentAttachment(ctx.params.id, ctx.params.attachmentId);
    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound("Adjunto no encontrado");
    const safeInline =
      req.nextUrl.searchParams.get("inline") === "1" &&
      (att.mimeType.startsWith("image/") || att.mimeType === "application/pdf");
    const disposition = safeInline ? "inline" : "attachment";
    return new Response(buf, {
      headers: {
        "Content-Type": att.mimeType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(att.fileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    return httpError(error, "Error al descargar el adjunto");
  }
}, "documentosLegales.calendario") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const DELETE = withPermission(async (_req: NextRequest, ctx) => {
  try {
    await deleteLegalDocumentAttachment(ctx.params.id, ctx.params.attachmentId);
    return noContent();
  } catch (error) {
    return httpError(error, "Error al eliminar el adjunto");
  }
}, "documentosLegales.calendario", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
