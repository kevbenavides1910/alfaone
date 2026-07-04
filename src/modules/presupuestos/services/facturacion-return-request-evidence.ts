import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  detectMimeFromBuffer,
  mimeMatchesDeclared,
} from "@/lib/security/file-validation";
import {
  ALLOWED_FACTURACION_MIMES,
  MAX_FACTURACION_FILE_BYTES,
  facturaReturnRequestEvidenceDir,
  storagePathForReturnRequestEvidence,
} from "@/modules/presupuestos/services/facturacion-uploads";
import type { FacturaReturnRequestEvidence } from "@/modules/presupuestos/services/facturacion-invoice-correction";

export async function saveFacturaReturnRequestEvidence(
  facturaId: string,
  file: File
): Promise<FacturaReturnRequestEvidence | { error: string }> {
  if (file.size > MAX_FACTURACION_FILE_BYTES) {
    return { error: "Archivo demasiado grande (máximo 15 MB)" };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const detected = detectMimeFromBuffer(buf);
  const declared = file.type || "application/octet-stream";
  if (!ALLOWED_FACTURACION_MIMES.has(declared)) {
    return { error: "Tipo de archivo no permitido (PDF, imágenes, Word o Excel)" };
  }
  if (!mimeMatchesDeclared(detected, declared)) {
    return { error: "El contenido del archivo no coincide con el tipo declarado" };
  }
  const mime = detected !== "application/octet-stream" ? detected : declared;

  const originalName = file.name || "evidencia";
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storedName = `${Date.now()}_${safe}`;

  const dir = facturaReturnRequestEvidenceDir(facturaId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), buf);

  return {
    path: storagePathForReturnRequestEvidence(facturaId, storedName),
    fileName: originalName.slice(0, 255),
    mimeType: mime,
  };
}
