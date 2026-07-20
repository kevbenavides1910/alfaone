import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 54;
export const TEXT = rgb(0.12, 0.12, 0.14);
export const MUTED = rgb(0.38, 0.38, 0.42);

export function sanitizePdfText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "");
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (w.length > maxChars) {
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
      continue;
    }
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

export function drawParagraph(
  page: PDFPage,
  text: string,
  x: number,
  yStart: number,
  maxW: number,
  size: number,
  font: PDFFont,
  color = TEXT,
  lineHeight = size + 4,
): number {
  const approxChars = Math.max(20, Math.floor(maxW / (size * 0.48)));
  let y = yStart;
  for (const line of wrapLines(sanitizePdfText(text.replace(/\r\n/g, "\n").replace(/\n/g, " ")), approxChars)) {
    page.drawText(line, { x, y, size, font, color, maxWidth: maxW });
    y -= lineHeight;
  }
  return y;
}

export function centerX(text: string, size: number, font: PDFFont, midX: number): number {
  const w = font.widthOfTextAtSize(sanitizePdfText(text), size);
  return midX - w / 2;
}

export function drawWatermark(page: PDFPage, logo: PDFImage | null) {
  if (!logo) return;
  const max = 320;
  const scale = Math.min(max / logo.width, max / logo.height);
  const w = logo.width * scale;
  const h = logo.height * scale;
  page.drawImage(logo, {
    x: (PAGE_W - w) / 2,
    y: (PAGE_H - h) / 2,
    width: w,
    height: h,
    opacity: 0.08,
  });
}

export function drawHeader(
  page: PDFPage,
  opts: {
    logo: PDFImage | null;
    companyLegalName: string;
    companyIdNumber: string;
    companyAddress: string;
    companyPhone: string;
    font: PDFFont;
    fontBold: PDFFont;
  },
): number {
  const { logo, companyLegalName, companyIdNumber, companyAddress, companyPhone, font, fontBold } = opts;
  let y = PAGE_H - MARGIN;

  if (logo) {
    const maxH = 56;
    const scale = Math.min(maxH / logo.height, 90 / logo.width);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, { x: MARGIN, y: y - h, width: w, height: h });
  }

  const rightX = PAGE_W - MARGIN;
  const lines = [
    { text: companyLegalName, size: 10, f: fontBold },
    { text: `CEDULA JURIDICA ${companyIdNumber}`, size: 9, f: font },
    { text: companyAddress, size: 8, f: font },
    { text: companyPhone, size: 8, f: font },
  ];
  let ty = y - 8;
  for (const line of lines) {
    const t = sanitizePdfText(line.text);
    const tw = line.f.widthOfTextAtSize(t, line.size);
    page.drawText(t, { x: rightX - tw, y: ty, size: line.size, font: line.f, color: TEXT });
    ty -= line.size + 4;
  }

  return Math.min(y - 70, ty - 12);
}

export async function embedLogo(
  pdf: PDFDocument,
  file: { bytes: Uint8Array; path: string } | null,
): Promise<PDFImage | null> {
  if (!file) return null;
  const lower = file.path.toLowerCase();
  try {
    if (lower.endsWith(".png")) return await pdf.embedPng(file.bytes);
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return await pdf.embedJpg(file.bytes);
  } catch {
    return null;
  }
  return null;
}
