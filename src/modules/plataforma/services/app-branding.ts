import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { buildDefaultBrandingIcon } from "@/modules/plataforma/branding-default-icon";
import { DEFAULT_PRIMARY_HEX, DEFAULT_SIDEBAR_HEX } from "@/modules/plataforma/branding-constants";

import { brandingUploadRoot } from "@/lib/storage/paths";

export const BRANDING_UPLOAD_ROOT = brandingUploadRoot();

export const ALLOWED_LOGO_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function mimeForLogoPath(logoPath: string): string {
  const lower = logoPath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "png";
}

/** Ruta absoluta segura bajo BRANDING_UPLOAD_ROOT */
export function absoluteBrandingFile(storedRelative: string): string {
  const normalized = storedRelative.replace(/\\/g, "/");
  if (normalized.includes("..") || !normalized.startsWith("branding/")) {
    throw new Error("Ruta de logo inválida");
  }
  const segments = normalized.split("/").filter(Boolean);
  return path.join(BRANDING_UPLOAD_ROOT, ...segments);
}

export function relativeLogoPath(mime: string): string {
  const ext = extensionForMime(mime);
  return `branding/logo.${ext}`;
}

/** Ruta almacenada para la firma fija del PDF disciplinario (mismo directorio que el logo). */
export function relativeDisciplinarySignaturePath(mime: string): string {
  const ext = extensionForMime(mime);
  return `branding/disciplinary-signature.${ext}`;
}

/** Firma de la encargada de RRHH para constancias públicas. */
export function relativeHrDocumentSignaturePath(mime: string): string {
  const ext = extensionForMime(mime);
  return `branding/hr-document-signature.${ext}`;
}

export async function ensureBrandingRow() {
  return prisma.appBranding.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      primaryHex: DEFAULT_PRIMARY_HEX,
      sidebarHex: DEFAULT_SIDEBAR_HEX,
    },
    update: {},
  });
}

export type BrandingLogoFile = { buffer: Buffer; mime: string };

/** Lee el logo configurado en marca y colores (mismo archivo que la barra lateral). */
export async function readBrandingLogoFile(): Promise<BrandingLogoFile | null> {
  const row = await prisma.appBranding.findUnique({ where: { id: "default" } });
  const rel = row?.logoPath?.trim();
  if (!rel) return null;

  try {
    const buffer = await readFile(absoluteBrandingFile(rel));
    return { buffer, mime: mimeForLogoPath(rel) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw e;
  }
}

/** Respuesta HTTP para favicon / apple-touch-icon (logo subido o icono por defecto). */
export async function buildBrandingIconResponse(size = 32): Promise<Response> {
  const row = await prisma.appBranding.findUnique({ where: { id: "default" } });
  const primaryHex = row?.primaryHex?.trim() || DEFAULT_PRIMARY_HEX;
  const logo = await readBrandingLogoFile();

  if (logo) {
    return new Response(new Uint8Array(logo.buffer), {
      headers: {
        "Content-Type": logo.mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return buildDefaultBrandingIcon(primaryHex, size);
}

