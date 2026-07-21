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
import {
  drawCenteredSignature,
  embedHrSignature,
  loadHrSignatureFile,
} from "@/modules/solicitudes-rrhh/services/pdf-signature";
import type { EmpleoSnapshot } from "@/modules/solicitudes-rrhh/services/empleo-lookup";
import {
  formatDateShort,
  formatExtensionClause,
} from "@/modules/solicitudes-rrhh/business/format";

export type CartaFclPdfInput = {
  empleo: EmpleoSnapshot;
  issuedAt: Date;
  companyLegalName: string;
  companyIdNumber: string;
  companyAddress: string;
  companyPhone: string;
  signerName: string;
  signerTitle: string;
  corporateGroupText: string;
};

export async function buildCartaFclPdf(input: CartaFclPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [logoFile, signatureFile] = await Promise.all([loadBrandingLogoFile(), loadHrSignatureFile()]);
  const logo = await embedLogo(pdf, logoFile);
  const signature = await embedHrSignature(pdf, signatureFile);

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

  y -= 24;
  page.drawText(sanitizePdfText("Senores: Operadora de pensiones:"), {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: TEXT,
  });
  y -= 18;
  page.drawText(sanitizePdfText("Estimados senores:"), {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: TEXT,
  });

  y -= 24;
  y = drawParagraph(
    page,
    "Para efectos del retiro del fondo de capitalizacion laboral FCL, le informo lo siguiente:",
    MARGIN,
    y,
    PAGE_W - MARGIN * 2,
    11,
    font,
    TEXT,
    16,
  );

  y -= 10;
  const desde = input.empleo.fechaIngreso
    ? formatDateShort(new Date(input.empleo.fechaIngreso))
    : "N/D";
  const hasta = input.empleo.fechaEgreso
    ? formatDateShort(new Date(input.empleo.fechaEgreso))
    : formatDateShort(input.issuedAt);

  const detalle =
    `El Sr(a). ${input.empleo.nombre} con cedula de identidad ${input.empleo.cedulaDisplay} ` +
    `laboro para nuestra empresa ${input.empleo.empresaNombre} desde el ${desde} hasta ${hasta}.`;
  y = drawParagraph(page, detalle, MARGIN, y, PAGE_W - MARGIN * 2, 11, font, TEXT, 16);

  y -= 12;
  y = drawParagraph(
    page,
    input.corporateGroupText,
    MARGIN,
    y,
    PAGE_W - MARGIN * 2,
    10,
    font,
    TEXT,
    14,
  );

  y -= 12;
  page.drawText(sanitizePdfText(`Se desempenaba como: ${input.empleo.puesto}`), {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: TEXT,
  });

  y -= 28;
  y = drawParagraph(
    page,
    `Se extiende la presente a solicitud del interesado, ${formatExtensionClause(input.issuedAt)}.`,
    MARGIN,
    y,
    PAGE_W - MARGIN * 2,
    11,
    font,
    TEXT,
    16,
  );

  y -= 20;
  page.drawText(sanitizePdfText("Se suscribe muy cordialmente."), {
    x: MARGIN,
    y,
    size: 11,
    font,
    color: TEXT,
  });

  y -= 24;
  y = drawCenteredSignature(page, signature, y, PAGE_W, 170, 60);

  y -= 4;
  const stampX = PAGE_W - MARGIN - 160;
  const stampLines = [input.companyLegalName, input.companyIdNumber, "RECURSOS HUMANOS"];
  let sy = y + 40;
  for (const line of stampLines) {
    page.drawText(sanitizePdfText(line), {
      x: stampX,
      y: sy,
      size: 8,
      font: fontBold,
      color: TEXT,
    });
    sy -= 11;
  }

  y -= 12;
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
