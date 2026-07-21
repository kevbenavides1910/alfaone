import { readFile } from "fs/promises";
import type { PDFDocument, PDFImage, PDFPage } from "pdf-lib";
import { prisma } from "@/modules/core/db/prisma";
import { absoluteBrandingFile } from "@/modules/plataforma/services/app-branding";
import { embedLogo } from "@/modules/solicitudes-rrhh/services/pdf-common";

export async function loadHrSignatureFile(): Promise<{ bytes: Uint8Array; path: string } | null> {
  const row = await prisma.hrDocumentRequestSettings.findUnique({ where: { id: "default" } });
  const p = row?.documentSignaturePath?.trim();
  if (!p) return null;
  try {
    const buf = await readFile(absoluteBrandingFile(p));
    return { bytes: new Uint8Array(buf), path: p };
  } catch {
    return null;
  }
}

export async function embedHrSignature(
  pdf: PDFDocument,
  file: { bytes: Uint8Array; path: string } | null,
): Promise<PDFImage | null> {
  return embedLogo(pdf, file);
}

/** Dibuja la firma centrada; retorna el Y inferior tras la imagen. */
export function drawCenteredSignature(
  page: PDFPage,
  signature: PDFImage | null,
  yTop: number,
  pageWidth: number,
  maxW = 160,
  maxH = 56,
): number {
  if (!signature) return yTop;
  const scale = Math.min(maxW / signature.width, maxH / signature.height);
  const sw = signature.width * scale;
  const sh = signature.height * scale;
  page.drawImage(signature, {
    x: (pageWidth - sw) / 2,
    y: yTop - sh,
    width: sw,
    height: sh,
  });
  return yTop - sh - 8;
}
