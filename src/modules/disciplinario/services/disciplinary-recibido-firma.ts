import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { apercibimientoEvidenceDir, storagePathForEvidence } from "./disciplinary-evidence-uploads";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { disciplinaryEvidenceUploadRoot } from "@/lib/storage/paths";

export const RECIBIDO_FIRMA_FILENAME = "firma-recibido.png";

export function storagePathForRecibidoFirma(apercibimientoId: string) {
  return storagePathForEvidence(apercibimientoId, RECIBIDO_FIRMA_FILENAME);
}

/** Decodifica data URL PNG (canvas) a buffer. */
export function decodeSignatureDataUrl(dataUrl: string): Buffer | { error: string } {
  const trimmed = dataUrl.trim();
  const m = trimmed.match(/^data:image\/png;base64,(.+)$/i);
  if (!m) return { error: "Formato de firma inválido (se espera PNG en base64)" };
  try {
    const buf = Buffer.from(m[1]!, "base64");
    if (buf.length < 32) return { error: "La firma está vacía" };
    if (buf.length > 512 * 1024) return { error: "La firma es demasiado grande (máximo 512 KB)" };
    return buf;
  } catch {
    return { error: "No se pudo decodificar la firma" };
  }
}

export async function saveRecibidoFirmaPng(
  apercibimientoId: string,
  pngBytes: Buffer,
): Promise<{ path: string }> {
  const dir = apercibimientoEvidenceDir(apercibimientoId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, RECIBIDO_FIRMA_FILENAME), pngBytes);
  return { path: storagePathForRecibidoFirma(apercibimientoId) };
}

export async function loadRecibidoFirmaFile(
  storedPath: string | null | undefined,
): Promise<{ bytes: Uint8Array; path: string } | null> {
  const rel = storedPath?.trim();
  if (!rel) return null;
  const abs = resolveUnderRoot(disciplinaryEvidenceUploadRoot(), rel);
  if (!abs) return null;
  try {
    const buf = await readFile(abs);
    return { bytes: new Uint8Array(buf), path: rel };
  } catch {
    return null;
  }
}
