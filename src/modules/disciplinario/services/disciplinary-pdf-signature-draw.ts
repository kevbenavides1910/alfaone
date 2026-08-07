import type { PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

const MUTED = rgb(0.38, 0.38, 0.42);
const TEXT = rgb(0.12, 0.12, 0.14);

export const DISCIPLINARY_SIGNER_TITLE = "Encargado de disciplinario";

function centerX(text: string, size: number, font: PDFFont, midX: number): number {
  return midX - font.widthOfTextAtSize(text, size) / 2;
}

/**
 * Dibuja la firma/sello del documento (centrada, sin recuadro) y el cargo.
 * Devuelve el cursorY bajo «Encargado de disciplinario».
 */
export function drawDocumentSignatureBlock(
  page: PDFPage,
  cursorY: number,
  midX: number,
  font: PDFFont,
  signatureImage: PDFImage | null,
  opts?: {
    bold?: PDFFont;
    /** Nombre del responsable (opcional). */
    signerName?: string | null;
  },
): number {
  // Hueco amplio horizontal: la firma ya viene recortada a la tinta.
  const sigSlotW = 280;
  const sigSlotH = 90;
  let y = cursorY;

  if (signatureImage) {
    const scale = Math.min(sigSlotW / signatureImage.width, sigSlotH / signatureImage.height);
    const fw = signatureImage.width * scale;
    const fh = signatureImage.height * scale;
    page.drawImage(signatureImage, {
      x: midX - fw / 2,
      y: y - fh,
      width: fw,
      height: fh,
    });
    y -= fh + 6;
  } else {
    y -= 8;
    page.drawLine({
      start: { x: midX - sigSlotW / 2, y },
      end: { x: midX + sigSlotW / 2, y },
      thickness: 0.5,
      color: MUTED,
    });
    y -= 10;
  }

  const firmaLabel = "Firma y sello";
  page.drawText(firmaLabel, {
    x: centerX(firmaLabel, 8, font, midX),
    y,
    size: 8,
    font,
    color: MUTED,
  });
  y -= 14;

  const name = opts?.signerName?.trim() || "";
  if (name && opts?.bold) {
    page.drawText(name, {
      x: centerX(name, 10, opts.bold, midX),
      y,
      size: 10,
      font: opts.bold,
      color: TEXT,
    });
    y -= 12;
  }

  page.drawText(DISCIPLINARY_SIGNER_TITLE, {
    x: centerX(DISCIPLINARY_SIGNER_TITLE, 9, font, midX),
    y,
    size: 9,
    font,
    color: MUTED,
  });
  return y - 14;
}
