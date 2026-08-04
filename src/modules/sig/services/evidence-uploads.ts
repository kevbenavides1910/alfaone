import path from "path";
import { sigEvidenceRoot } from "@/lib/storage/paths";

export const SIG_EVIDENCE_ROOT = sigEvidenceRoot();

export function sigEvidenceDir(evidenceId: string) {
  return path.join(SIG_EVIDENCE_ROOT, evidenceId);
}

/** Relative to SIG_EVIDENCE_ROOT */
export function storagePathForSigEvidence(evidenceId: string, storedFileName: string) {
  return path.join(evidenceId, storedFileName);
}

export const ALLOWED_SIG_EVIDENCE_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "audio/mpeg",
  "audio/wav",
  "video/mp4",
  "video/webm",
]);

export const MAX_SIG_EVIDENCE_BYTES = 50 * 1024 * 1024;
