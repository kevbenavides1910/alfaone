import path from "path";
import { appDataRoot, STORAGE_DIRS } from "@/lib/storage/paths";

export const FACTURACION_UPLOAD_ROOT = path.join(appDataRoot(), STORAGE_DIRS.facturacion);

export function facturaRequisitoDir(facturaId: string, requisitoId: string) {
  return path.join(FACTURACION_UPLOAD_ROOT, facturaId, requisitoId);
}

/** Ruta relativa a FACTURACION_UPLOAD_ROOT */
export function storagePathForRequisito(
  facturaId: string,
  requisitoId: string,
  storedFileName: string
) {
  return path.join(facturaId, requisitoId, storedFileName);
}

export const ALLOWED_FACTURACION_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export const MAX_FACTURACION_FILE_BYTES = 15 * 1024 * 1024;
