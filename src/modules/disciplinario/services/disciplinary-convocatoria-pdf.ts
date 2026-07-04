import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from "pdf-lib";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { embedBrandingLogo, embedDisciplinarySignatureImage } from "@/modules/disciplinario/services/disciplinary-pdf-logo";
import { APP_DOCUMENT_FOOTER } from "@/modules/plataforma/branding-constants";

export const CONVOCATORIA_OFICINAS_TEXTO =
  "oficinas de Seguridad Alfa ubicadas en Sabana este";

export type ConvocatoriaPdfInput = {
  nombreEmpleado: string;
  fechaCarta: Date;
  fechaConvocatoria: Date;
  /** Texto legible, p. ej. «11 horas» o «11:30 horas». */
  horaConvocatoriaTexto: string;
  documentFooter?: string | null;
  formCode?: string | null;
  formRevision?: string | null;
  formVersion?: string | null;
  brandingLogoFile?: { bytes: Uint8Array; path: string } | null;
  signatureImageFile?: { bytes: Uint8Array; path: string } | null;
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 42;
const BLUE = rgb(0.1, 0.35, 0.62);
const TEXT = rgb(0.12, 0.12, 0.14);
const MUTED = rgb(0.38, 0.38, 0.42);
const BORDER = rgb(0.55, 0.55, 0.58);

function sanitizePdfText(text: string): string {
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

function fmtDate(d: Date): string {
  return format(d, "dd/MM/yyyy", { locale: es });
}

/** Fecha de cita en carta: 28-4-2026 */
export function formatConvocatoriaCitaDate(d: Date): string {
  return format(d, "d-M-yyyy", { locale: es });
}

/** Convierte HH:MM a texto «N horas» / «N:M horas». */
export function formatConvocatoriaHoraTexto(hora: string): string {
  const m = hora.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hora.trim() || "—";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min === 0) return `${h} horas`;
  return `${h}:${String(min).padStart(2, "0")} horas`;
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
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

function centerX(text: string, size: number, font: PDFFont, midX: number): number {
  const w = font.widthOfTextAtSize(text, size);
  return midX - w / 2;
}

function drawParagraph(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  lineH: number,
): number {
  const maxChars = Math.max(20, Math.floor(maxW / (size * 0.52)));
  for (const ln of wrapLines(text, maxChars)) {
    page.drawText(ln, { x, y, size, font, color });
    y -= lineH;
  }
  return y;
}

export function buildConvocatoriaLetterBody(input: {
  nombreEmpleado: string;
  fechaConvocatoria: Date;
  horaConvocatoriaTexto: string;
  oficinasTexto?: string;
}): string {
  const nombre = input.nombreEmpleado.trim();
  const cita = formatConvocatoriaCitaDate(input.fechaConvocatoria);
  const oficinas = input.oficinasTexto?.trim() || CONVOCATORIA_OFICINAS_TEXTO;
  const hora = input.horaConvocatoriaTexto.trim();

  return (
    `Por este medio se le convoca a que se haga presente a las ${oficinas}, el día ${cita} a las ${hora}.\n\n` +
    `Se le indica que ese día usted deberá presentarse obligatoriamente a las instalaciones de la empresa y no será necesario que asista y reciba su puesto de trabajo. Será hasta que se concluya con la convocatoria indicada, que se podría gestionar su reincorporación al puesto que actualmente se encuentra cubriendo, de ser necesario.`
  );
}

export async function buildConvocatoriaPdfBytes(rawInput: ConvocatoriaPdfInput): Promise<Uint8Array> {
  const nombreEmpleado = sanitizePdfText(rawInput.nombreEmpleado.trim());
  const horaTexto = sanitizePdfText(rawInput.horaConvocatoriaTexto.trim());
  const cuerpo = buildConvocatoriaLetterBody({
    nombreEmpleado,
    fechaConvocatoria: rawInput.fechaConvocatoria,
    horaConvocatoriaTexto: horaTexto,
  });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MARGIN;

  const logoImage: PDFImage | null = await embedBrandingLogo(pdf, rawInput.brandingLogoFile ?? null);
  const signatureImage: PDFImage | null = await embedDisciplinarySignatureImage(
    pdf,
    rawInput.signatureImageFile ?? null,
  );

  const headerH = 92;
  const tableLeft = MARGIN;
  const tableW = PAGE_W - 2 * MARGIN;
  const col1W = 118;
  const col2W = 268;
  const headerBottom = cursorY - headerH;

  page.drawRectangle({
    x: tableLeft,
    y: headerBottom,
    width: tableW,
    height: headerH,
    borderWidth: 0.75,
    borderColor: BORDER,
  });

  const xDiv1 = tableLeft + col1W;
  const xDiv2 = xDiv1 + col2W;
  page.drawLine({
    start: { x: xDiv1, y: headerBottom },
    end: { x: xDiv1, y: cursorY },
    thickness: 0.75,
    color: BORDER,
  });
  page.drawLine({
    start: { x: xDiv2, y: headerBottom },
    end: { x: xDiv2, y: cursorY },
    thickness: 0.75,
    color: BORDER,
  });

  if (logoImage) {
    const maxW = col1W - 16;
    const maxH = headerH - 16;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: tableLeft + (col1W - w) / 2,
      y: headerBottom + (headerH - h) / 2,
      width: w,
      height: h,
    });
  }

  const mid2 = xDiv1 + col2W / 2;
  page.drawText("FORMULARIO", {
    x: centerX("FORMULARIO", 9, font, mid2),
    y: headerBottom + headerH - 22,
    size: 9,
    font,
    color: MUTED,
  });
  const subtitle = "Convocatoria a oficinas";
  page.drawText(subtitle, {
    x: centerX(subtitle, 11, bold, mid2),
    y: headerBottom + headerH - 40,
    size: 11,
    font: bold,
    color: BLUE,
  });

  const code = rawInput.formCode?.trim() || "F-RH-30";
  const rev = rawInput.formRevision?.trim() || "-";
  const ver = rawInput.formVersion?.trim() || "-";
  const metaX = xDiv2 + 8;
  let metaY = headerBottom + headerH - 20;
  const metaSize = 8.5;
  const drawMeta = (label: string, value: string) => {
    page.drawText(label, { x: metaX, y: metaY, size: metaSize, font: bold, color: TEXT });
    const lw = bold.widthOfTextAtSize(label, metaSize);
    page.drawText(value, { x: metaX + lw + 4, y: metaY, size: metaSize, font, color: TEXT });
    metaY -= 13;
  };
  drawMeta("Código:", code);
  drawMeta("Modificación:", rev);
  drawMeta("Versión:", ver);
  drawMeta("Página:", "1");

  cursorY = headerBottom - 28;
  const bodyLeft = MARGIN;
  const bodyW = PAGE_W - 2 * MARGIN;
  const lineH = 13;

  page.drawText(`Fecha: ${fmtDate(rawInput.fechaCarta)}`, {
    x: bodyLeft,
    y: cursorY,
    size: 11,
    font,
    color: TEXT,
  });
  cursorY -= lineH * 2;

  page.drawText("Señor (a)", { x: bodyLeft, y: cursorY, size: 11, font, color: TEXT });
  cursorY -= lineH;
  page.drawText(nombreEmpleado.toUpperCase(), { x: bodyLeft, y: cursorY, size: 12, font: bold, color: TEXT });
  cursorY -= lineH * 2;

  page.drawText("Estimado Señor (a):", { x: bodyLeft, y: cursorY, size: 11, font, color: TEXT });
  cursorY -= lineH * 1.6;

  const paras = cuerpo.split(/\n\s*\n/).map((p) => p.trim().replace(/\n/g, " ")).filter(Boolean);
  for (const para of paras) {
    cursorY = drawParagraph(page, para, bodyLeft, cursorY, bodyW, 10.5, font, TEXT, 13);
    cursorY -= 6;
  }
  cursorY -= 24;

  const valediction = "Atentamente";
  page.drawText(valediction, { x: bodyLeft, y: cursorY, size: 11, font, color: TEXT });
  cursorY -= 22;

  if (signatureImage) {
    const sigSlotW = 220;
    const sigSlotH = 72;
    const scale = Math.min(sigSlotW / signatureImage.width, sigSlotH / signatureImage.height);
    const sw = signatureImage.width * scale;
    const sh = signatureImage.height * scale;
    page.drawImage(signatureImage, {
      x: bodyLeft,
      y: cursorY - sh,
      width: sw,
      height: sh,
    });
    cursorY -= sh + 8;
  }

  const foot = rawInput.documentFooter?.trim() || APP_DOCUMENT_FOOTER;
  drawParagraph(page, foot, bodyLeft, Math.max(cursorY - 20, 72), bodyW, 8, font, MUTED, 10);

  return pdf.save();
}
