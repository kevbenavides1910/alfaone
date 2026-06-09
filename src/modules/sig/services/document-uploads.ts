import path from "path";
import { sigDocumentsRoot } from "@/lib/storage/paths";

export const SIG_DOCUMENTS_ROOT = sigDocumentsRoot();

export function sigDocumentDir(documentId: string) {
  return path.join(SIG_DOCUMENTS_ROOT, documentId);
}

/** Relative to SIG_DOCUMENTS_ROOT */
export function storagePathForSigFile(documentId: string, storedFileName: string) {
  return path.join(documentId, storedFileName);
}

export const ALLOWED_SIG_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
]);

export const MAX_SIG_DOCUMENT_BYTES = 50 * 1024 * 1024;
