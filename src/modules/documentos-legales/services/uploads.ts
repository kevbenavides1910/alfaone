import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { legalDocumentUploadRoot } from "@/lib/storage/paths";
import { detectMimeFromBuffer, mimeMatchesDeclared } from "@/lib/security/file-validation";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import type { LegalAttachmentDto } from "../business/dto";
import { LegalDocumentError } from "./errors";

export const LEGAL_DOCUMENT_UPLOAD_ROOT = legalDocumentUploadRoot();
export const MAX_LEGAL_DOCUMENT_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const ALLOWED_LEGAL_DOCUMENT_ATTACHMENT_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

function attachmentDir(documentId: string) {
  return path.join(LEGAL_DOCUMENT_UPLOAD_ROOT, documentId);
}

function storagePathForFile(documentId: string, storedFileName: string) {
  return path.join(documentId, storedFileName);
}

function toDto(row: {
  id: string;
  legalDocumentId: string;
  fileName: string;
  mimeType: string;
  note: string | null;
  createdAt: Date;
  uploadedBy: { id: string; name: string };
}): LegalAttachmentDto {
  return {
    id: row.id,
    legalDocumentId: row.legalDocumentId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    uploadedBy: row.uploadedBy,
    downloadUrl: `/api/documentos-legales/${row.legalDocumentId}/attachments/${row.id}`,
  };
}

export async function listLegalDocumentAttachments(documentId: string): Promise<LegalAttachmentDto[]> {
  const doc = await prisma.legalDocument.findUnique({ where: { id: documentId }, select: { id: true } });
  if (!doc) throw new LegalDocumentError("Documento no encontrado", "NOT_FOUND");
  const rows = await prisma.legalDocumentAttachment.findMany({
    where: { legalDocumentId: documentId },
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  return rows.map(toDto);
}

export async function saveLegalDocumentAttachment(input: {
  documentId: string;
  userId: string;
  fileName: string;
  declaredMime: string;
  buffer: Buffer;
  note: string | null;
}): Promise<LegalAttachmentDto> {
  const doc = await prisma.legalDocument.findUnique({
    where: { id: input.documentId },
    select: { id: true },
  });
  if (!doc) throw new LegalDocumentError("Documento no encontrado", "NOT_FOUND");
  if (input.buffer.length > MAX_LEGAL_DOCUMENT_ATTACHMENT_BYTES) {
    throw new LegalDocumentError("Archivo demasiado grande (máximo 15 MB)", "BAD_REQUEST");
  }
  if (!ALLOWED_LEGAL_DOCUMENT_ATTACHMENT_MIMES.has(input.declaredMime)) {
    throw new LegalDocumentError("Tipo no permitido (PDF, imágenes, Excel o CSV)", "BAD_REQUEST");
  }
  const detected = detectMimeFromBuffer(input.buffer);
  if (!mimeMatchesDeclared(detected, input.declaredMime)) {
    throw new LegalDocumentError("El contenido del archivo no coincide con el tipo declarado", "BAD_REQUEST");
  }
  const mime = detected !== "application/octet-stream" ? detected : input.declaredMime;
  const safe = (input.fileName || "adjunto").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storedName = `${Date.now()}_${safe}`;
  const dir = attachmentDir(input.documentId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), input.buffer);

  const row = await prisma.legalDocumentAttachment.create({
    data: {
      legalDocumentId: input.documentId,
      uploadedById: input.userId,
      fileName: (input.fileName || "adjunto").slice(0, 255),
      mimeType: mime,
      storagePath: storagePathForFile(input.documentId, storedName),
      note: input.note,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });
  return toDto(row);
}

export async function getLegalDocumentAttachment(documentId: string, attachmentId: string) {
  const att = await prisma.legalDocumentAttachment.findFirst({
    where: { id: attachmentId, legalDocumentId: documentId },
  });
  if (!att) throw new LegalDocumentError("Adjunto no encontrado", "NOT_FOUND");
  const abs = resolveUnderRoot(LEGAL_DOCUMENT_UPLOAD_ROOT, att.storagePath);
  if (!abs) throw new LegalDocumentError("Adjunto no encontrado", "NOT_FOUND");
  return { att, abs };
}

export async function deleteLegalDocumentAttachment(documentId: string, attachmentId: string) {
  const { att, abs } = await getLegalDocumentAttachment(documentId, attachmentId);
  await prisma.legalDocumentAttachment.delete({ where: { id: att.id } });
  await unlink(abs).catch(() => undefined);
}

export async function deleteStoredLegalAttachments(
  rows: { storagePath: string }[],
) {
  for (const row of rows) {
    const abs = resolveUnderRoot(LEGAL_DOCUMENT_UPLOAD_ROOT, row.storagePath);
    if (abs) await unlink(abs).catch(() => undefined);
  }
}
