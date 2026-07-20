import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  MARGIN,
  PAGE_H,
  PAGE_W,
  TEXT,
  centerX,
  drawHeader,
  drawParagraph,
  drawWatermark,
  embedLogo,
  sanitizePdfText,
} from "@/modules/solicitudes-rrhh/services/pdf-common";
import { loadBrandingLogoFile } from "@/modules/disciplinario/services/disciplinary-pdf-logo";
import type { EmpleoSnapshot } from "@/modules/solicitudes-rrhh/services/empleo-lookup";
import {
  formatDateLongEs,
} from "@/modules/solicitudes-rrhh/business/format";

export type CartaServicioPdfInput = {
  empleo: EmpleoSnapshot;
  issuedAt: Date;
  companyLegalName: string;
  companyIdNumber: string;
  companyAddress: string;
  companyPhone: string;
  signerName: string;
  signerTitle: string;
};

export async function buildCartaServicioPdf(input: CartaServicioPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoFile = await loadBrandingLogoFile();
  const logo = await embedLogo(pdf, logoFile);

  drawWatermark(page, logo);
  let y = drawHeader(page, {
    logo,
    companyLegalName: input.companyLegalName,
    companyIdNumber: input.companyIdNumber,
    companyAddress: input.companyAddress,
    companyPhone: input.companyPhone,
    font,
    fontBold,
  });

  y -= 18;
  const title = "CARTA DE SERVICIO";
  page.drawText(title, {
    x: centerX(title, 14, fontBold, PAGE_W / 2),
    y,
    size: 14,
    font: fontBold,
    color: TEXT,
  });
  const titleW = fontBold.widthOfTextAtSize(title, 14);
  page.drawLine({
    start: { x: (PAGE_W - titleW) / 2, y: y - 2 },
    end: { x: (PAGE_W + titleW) / 2, y: y - 2 },
    thickness: 1,
    color: TEXT,
  });

  y -= 28;
  const saludo = "A QUIEN INTERESE";
  page.drawText(saludo, { x: MARGIN, y, size: 11, font: fontBold, color: TEXT });
  page.drawLine({
    start: { x: MARGIN, y: y - 2 },
    end: { x: MARGIN + fontBold.widthOfTextAtSize(saludo, 11), y: y - 2 },
    thickness: 1,
    color: TEXT,
  });

  y -= 28;
  const fechaHoy = formatDateLongEs(input.issuedAt);
  const intro =
    `En mi calidad de funcionario del departamento de Recursos humanos, extendemos constancia hoy ${fechaHoy}, ` +
    `de acuerdo al Articulo 35, del Codigo de Trabajo a solicitud de;`;
  y = drawParagraph(page, intro, MARGIN, y, PAGE_W - MARGIN * 2, 11, font, TEXT, 16);

  y -= 12;
  const ingreso = input.empleo.fechaIngreso
    ? formatDateLongEs(new Date(input.empleo.fechaIngreso))
    : "NO REGISTRADA";
  const salida = input.empleo.fechaEgreso
    ? formatDateLongEs(new Date(input.empleo.fechaEgreso))
    : "Al dia de hoy (labora actualmente)";

  const bullets = [
    `TRABAJADOR: ${input.empleo.nombre}`,
    `CEDULA: ${input.empleo.cedulaDisplay}`,
    `FECHA DE INGRESO: ${ingreso}`,
    `FECHA DE SALIDA: ${salida}`,
    `PUESTO: ${input.empleo.puesto}`,
  ];
  for (const b of bullets) {
    page.drawText(sanitizePdfText(`- ${b}`), { x: MARGIN + 8, y, size: 11, font, color: TEXT });
    y -= 18;
  }

  y -= 16;
  page.drawText(sanitizePdfText("Sin mas por el momento, me suscribo"), {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: TEXT,
  });

  y -= 56;
  const stampLines = [
    input.companyLegalName,
    input.companyIdNumber,
    "RECURSOS HUMANOS",
  ];
  for (const line of stampLines) {
    const t = sanitizePdfText(line);
    page.drawText(t, {
      x: centerX(t, 9, fontBold, PAGE_W / 2),
      y,
      size: 9,
      font: fontBold,
      color: TEXT,
    });
    y -= 12;
  }

  y -= 28;
  const signerBlock = [
    input.signerName,
    input.signerTitle,
    input.companyLegalName,
    input.companyPhone,
  ];
  for (const line of signerBlock) {
    const t = sanitizePdfText(line);
    page.drawText(t, {
      x: centerX(t, 10, fontBold, PAGE_W / 2),
      y,
      size: 10,
      font: fontBold,
      color: TEXT,
    });
    y -= 14;
  }

  return pdf.save();
}
