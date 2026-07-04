import { z } from "zod";
import { assertMaxBytes, detectMimeFromBuffer, mimeMatchesDeclared } from "@/lib/security/file-validation";
import {
  EXTENSION_MIME_HINTS,
  TICKETS_ATTACHMENT_CONFIG,
  isAllowedTicketExtension,
  maxFilesForContext,
  normalizeExtension,
  type TicketAttachmentContext,
} from "../config/tickets.config";

export const attachmentUploadMetaSchema = z.object({
  commentId: z.string().trim().min(1).optional().nullable(),
});

export type AttachmentValidationInput = {
  file: File;
  buffer: Buffer;
  context: TicketAttachmentContext;
  existingTicketCount: number;
  existingCommentCount?: number;
};

export type AttachmentValidationOk = {
  ok: true;
  mimeType: string;
  extension: string;
  originalName: string;
};

export type AttachmentValidationFail = { ok: false; error: string };

function resolveMimeType(ext: string, buffer: Buffer, declared: string): string {
  const detected = detectMimeFromBuffer(buffer);
  const declaredBase = declared.toLowerCase().split(";")[0].trim();
  const hints = isAllowedTicketExtension(ext) ? EXTENSION_MIME_HINTS[ext] : [];

  if (detected !== "application/octet-stream") {
    if (hints.includes(detected) || mimeMatchesDeclared(detected, declaredBase)) {
      return detected;
    }
  }
  if (declaredBase && declaredBase !== "application/octet-stream" && hints.includes(declaredBase)) {
    return declaredBase;
  }
  if (hints.length > 0) return hints[0];
  return detected !== "application/octet-stream" ? detected : "application/octet-stream";
}

export function validateTicketAttachment(
  input: AttachmentValidationInput
): AttachmentValidationOk | AttachmentValidationFail {
  const { file, buffer, context } = input;
  const originalName = (file.name || "archivo")
    .replace(/[^a-zA-Z0-9._\u00C0-\u024F-]/g, "_")
    .slice(0, 200);
  const extension = normalizeExtension(originalName);

  if (!extension || !isAllowedTicketExtension(extension)) {
    return { ok: false, error: `Extensión «.${extension || "?"}» no permitida` };
  }

  const sizeErr = assertMaxBytes(file.size, TICKETS_ATTACHMENT_CONFIG.maxFileBytes, "Archivo");
  if (sizeErr) return { ok: false, error: sizeErr };

  const max = maxFilesForContext(context);
  const current =
    context === "comment" ? (input.existingCommentCount ?? 0) : input.existingTicketCount;
  if (current >= max) {
    return {
      ok: false,
      error: `Máximo ${max} archivo(s) ${context === "comment" ? "por comentario" : "por ticket"}`,
    };
  }

  const mimeType = resolveMimeType(extension, buffer, file.type || "");

  return { ok: true, mimeType, extension, originalName };
}
