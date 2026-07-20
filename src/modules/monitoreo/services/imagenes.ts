import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { monitoreoUploadRoot } from "@/lib/storage/paths";

export type MonitoreoImagenRef = {
  url: string;
  fileName: string;
  mimeType?: string;
};

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export function monitoreoImagePublicPath(fileName: string): string {
  return `/api/monitoreo/imagenes/${encodeURIComponent(fileName)}`;
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

export async function saveMonitoreoImage(file: {
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<MonitoreoImagenRef> {
  const mime = (file.mimeType || "image/jpeg").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Solo se permiten imágenes JPEG, PNG, WebP o GIF");
  }
  if (file.buffer.length === 0) throw new Error("Archivo vacío");
  if (file.buffer.length > MAX_BYTES) throw new Error("La imagen supera 8 MB");

  const fileName = `${randomUUID()}.${extFromMime(mime)}`;
  const dir = monitoreoUploadRoot();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), file.buffer);

  return {
    url: monitoreoImagePublicPath(fileName),
    fileName,
    mimeType: mime,
  };
}

export async function readMonitoreoImage(fileName: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) return null;
  const full = path.join(monitoreoUploadRoot(), fileName);
  try {
    const buffer = await readFile(full);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

export function parseImagenesJson(value: unknown): MonitoreoImagenRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is MonitoreoImagenRef =>
      !!v &&
      typeof v === "object" &&
      typeof (v as MonitoreoImagenRef).url === "string" &&
      typeof (v as MonitoreoImagenRef).fileName === "string",
  );
}
