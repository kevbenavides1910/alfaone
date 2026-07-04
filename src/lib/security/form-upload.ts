import { assertMaxBytes, MAX_IMPORT_BYTES } from "@/lib/security/file-validation";

export type UploadReadResult =
  | { ok: true; buffer: ArrayBuffer; size: number; fileName: string }
  | { ok: false; message: string };

export async function readBoundedUpload(
  form: FormData,
  field = "file",
  maxBytes = MAX_IMPORT_BYTES,
): Promise<UploadReadResult> {
  const file = form.get(field);
  if (!file || !(file instanceof Blob)) {
    return { ok: false, message: "Archivo requerido" };
  }
  const sizeErr = assertMaxBytes(file.size, maxBytes);
  if (sizeErr) return { ok: false, message: sizeErr };
  const buffer = await file.arrayBuffer();
  const fileName = file instanceof File && file.name ? file.name : "upload";
  return { ok: true, buffer, size: file.size, fileName };
}
