import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { disciplinaryEvidenceUploadRoot } from "@/lib/storage/paths";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";

export const DISCIPLINARY_EVIDENCE_UPLOAD_ROOT = disciplinaryEvidenceUploadRoot();

export function apercibimientoEvidenceDir(apercibimientoId: string) {
  return path.join(DISCIPLINARY_EVIDENCE_UPLOAD_ROOT, apercibimientoId);
}

/** Ruta relativa a DISCIPLINARY_EVIDENCE_UPLOAD_ROOT */
export function storagePathForEvidence(apercibimientoId: string, storedFileName: string) {
  return path.join(apercibimientoId, storedFileName);
}

export const ALLOWED_DISCIPLINARY_EVIDENCE_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

export const MAX_DISCIPLINARY_EVIDENCE_BYTES = 15 * 1024 * 1024;

export function isWebStoredEvidencia(stored: string | null | undefined): boolean {
  if (!stored?.trim()) return false;
  return resolveUnderRoot(DISCIPLINARY_EVIDENCE_UPLOAD_ROOT, stored.trim()) !== null;
}

export function mapEvidenciaAnulacionFlags(stored: string | null | undefined, apercibimientoId: string) {
  const hasEvidencia = !!stored?.trim();
  const descargable = isWebStoredEvidencia(stored);
  return {
    evidenciaDisponible: hasEvidencia,
    evidenciaDescargable: descargable,
    evidenciaUrl: descargable
      ? `/api/disciplinary/apercibimientos/${apercibimientoId}/evidencia-anulacion`
      : null,
  };
}

export async function saveDisciplinaryAnulacionEvidence(
  apercibimientoId: string,
  file: File,
): Promise<{ path: string; fileName: string; mimeType: string } | { error: string }> {
  if (file.size > MAX_DISCIPLINARY_EVIDENCE_BYTES) {
    return { error: "Archivo demasiado grande (máximo 15 MB)" };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const detected = detectMimeFromBuffer(buf);
  const declared = file.type || "application/octet-stream";
  if (!ALLOWED_DISCIPLINARY_EVIDENCE_MIMES.has(declared)) {
    return { error: "Tipo de archivo no permitido (PDF, imágenes, Word o Excel)" };
  }
  if (!mimeMatchesDeclared(detected, declared)) {
    return { error: "El contenido del archivo no coincide con el tipo declarado" };
  }
  const mime = detected !== "application/octet-stream" ? detected : declared;

  const originalName = file.name || "evidencia";
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storedName = `${Date.now()}_${safe}`;

  const dir = apercibimientoEvidenceDir(apercibimientoId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), buf);

  return {
    path: storagePathForEvidence(apercibimientoId, storedName),
    fileName: originalName.slice(0, 255),
    mimeType: mime,
  };
}
