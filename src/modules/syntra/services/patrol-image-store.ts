import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/** Directorio escribible en producción (montado en /data dentro del contenedor). */
export function patrolUploadRoot(): string {
  const explicit = process.env.PATROL_UPLOAD_DIR?.trim();
  if (explicit) return path.resolve(explicit);

  const appData = process.env.APP_DATA_ROOT?.trim();
  if (appData) return path.join(path.resolve(appData), "patrol-uploads");

  if (process.env.EXPENSE_UPLOAD_DIR?.trim()) {
    return path.join(path.resolve(process.env.EXPENSE_UPLOAD_DIR), "..", "patrol-uploads");
  }

  return path.join(process.cwd(), "uploads", "patrol-uploads");
}

export function patrolImagePublicPath(fileName: string): string {
  return `/api/admin/patrol/uploads/${fileName}`;
}

export async function savePatrolImage(
  imageBase64: string | null | undefined,
  mimeType: string | null | undefined,
): Promise<{ imagePath: string | null; imageMimeType: string | null; imageFileName: string | null }> {
  if (!imageBase64 || imageBase64.trim() === "" || imageBase64.trim() === "NO") {
    return { imagePath: null, imageMimeType: null, imageFileName: null };
  }

  const raw = imageBase64.replace(/^data:[^;]+;base64,/, "").trim();
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 0) {
    return { imagePath: null, imageMimeType: null, imageFileName: null };
  }

  const mime = mimeType?.trim() || "image/jpeg";
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const fileName = `${randomUUID()}.${ext}`;
  const dir = patrolUploadRoot();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buf);

  return {
    imagePath: patrolImagePublicPath(fileName),
    imageMimeType: mime,
    imageFileName: fileName,
  };
}
