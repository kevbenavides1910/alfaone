import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, created, notFound, ok, serverError } from "@/lib/api/response";
import { LegalDocumentError } from "@/modules/documentos-legales/services/errors";
import {
  listLegalDocumentAttachments,
  saveLegalDocumentAttachment,
} from "@/modules/documentos-legales/services/uploads";

type Ctx = { params: Promise<{ id: string }> };

function httpError(error: unknown, fallback: string) {
  if (error instanceof LegalDocumentError) {
    return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
  }
  return serverError(fallback, error);
}

export const GET = withPermission(async (_req: NextRequest, ctx) => {
  try {
    return ok(await listLegalDocumentAttachments(ctx.params.id));
  } catch (error) {
    return httpError(error, "Error al listar adjuntos");
  }
}, "documentosLegales.calendario") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const POST = withPermission(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.session.user?.id;
    if (!userId) return badRequest("Sesión sin usuario");
    const form = await req.formData();
    const file = form.get("file");
    const noteRaw = form.get("note");
    const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 2000) : null;
    if (!file || typeof file === "string") return badRequest("Archivo requerido");
    const blob = file as File;
    const saved = await saveLegalDocumentAttachment({
      documentId: ctx.params.id,
      userId,
      fileName: blob.name || "adjunto",
      declaredMime: blob.type || "application/octet-stream",
      buffer: Buffer.from(await blob.arrayBuffer()),
      note,
    });
    return created(saved);
  } catch (error) {
    return httpError(error, "Error al subir el adjunto");
  }
}, "documentosLegales.calendario", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
