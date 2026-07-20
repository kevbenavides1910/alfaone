/**
 * Rutas de archivos de usuario (PDF, imágenes, Office, etc.).
 * En servidor: siempre bajo disco grande — ver docs/STORAGE.md y scripts/setup-storage.sh
 */
import path from "path";

/** Raíz en el host (ej. /mnt/storage/apps/presupuestos-alfa). En Docker suele montarse en /data. */
export function appDataRoot(): string {
  const fromEnv = process.env.APP_DATA_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  if (process.env.EXPENSE_UPLOAD_DIR?.trim()) {
    return path.resolve(process.env.EXPENSE_UPLOAD_DIR, "..");
  }
  if (process.env.BRANDING_UPLOAD_DIR?.trim()) {
    return path.resolve(process.env.BRANDING_UPLOAD_DIR, "..");
  }
  return path.join(process.cwd(), "uploads");
}

export const STORAGE_DIRS = {
  expenses: "expense-uploads",
  branding: "branding",
  sigDocuments: "sig-documents",
  facturacion: "facturacion-uploads",
  feElectronica: "fe-electronica",
  disciplinaryEvidence: "disciplinary-evidence",
  ticketsTi: "tickets-ti",
  monitoreo: "monitoreo-uploads",
  /** Exportaciones / temporales generados (futuro) */
  exports: "exports",
} as const;

export function expenseUploadRoot(): string {
  const explicit = process.env.EXPENSE_UPLOAD_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  return path.join(appDataRoot(), STORAGE_DIRS.expenses);
}

export function brandingUploadRoot(): string {
  const explicit = process.env.BRANDING_UPLOAD_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  return path.join(appDataRoot(), STORAGE_DIRS.branding);
}

export function sigDocumentsRoot(): string {
  const explicit = process.env.SIG_DOCUMENTS_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  return path.join(appDataRoot(), STORAGE_DIRS.sigDocuments);
}

export function disciplinaryEvidenceUploadRoot(): string {
  const explicit = process.env.DISCIPLINARY_EVIDENCE_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  return path.join(appDataRoot(), STORAGE_DIRS.disciplinaryEvidence);
}

export function ticketsTiUploadRoot(): string {
  const explicit = process.env.TICKETS_TI_UPLOAD_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  return path.join(appDataRoot(), STORAGE_DIRS.ticketsTi);
}

export function monitoreoUploadRoot(): string {
  const explicit = process.env.MONITOREO_UPLOAD_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  return path.join(appDataRoot(), STORAGE_DIRS.monitoreo);
}

/** Ruta dentro del contenedor cuando se monta APP_DATA_HOST → /data */
export const DOCKER_DATA_MOUNT = "/data";
