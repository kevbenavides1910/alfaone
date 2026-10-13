import path from "path";
import { contractCartelUploadRoot } from "@/lib/storage/paths";

/** Raíz de los carteles subidos (por defecto: <APP_DATA_ROOT>/contract-cartels). */
export const CONTRACT_CARTEL_ROOT = contractCartelUploadRoot();

/** Carpeta de un contrato dentro de la raíz. */
export function contractCartelDir(contractId: string) {
  return path.join(CONTRACT_CARTEL_ROOT, contractId);
}

/** Ruta relativa a la raíz (p. ej. `<contractId>/<archivo>`). */
export function cartelStoragePath(contractId: string, storedFileName: string) {
  return path.join(contractId, storedFileName);
}

/** Tipos aceptados para el cartel (PDF, imágenes escaneadas y Word). */
export const ALLOWED_CARTEL_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

export const MAX_CARTEL_BYTES = 30 * 1024 * 1024;
