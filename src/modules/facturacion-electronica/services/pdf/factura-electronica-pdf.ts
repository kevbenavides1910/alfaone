import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from "pdf-lib";
import QRCode from "qrcode";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { embedBrandingLogo } from "@/modules/disciplinario/services/disciplinary-pdf-logo";
import { feQrConsultaUrl } from "../../utils/fe-qr-url";
import type { FeAmbiente } from "@prisma/client";

export type FeFacturaPdfInput = {
  ambiente: FeAmbiente;
  logoFile?: { bytes: Uint8Array; path: string } | null;
  emisor: {
    razonSocial: string;
    nombreComercial: string;
    cedulaJuridica: string;
    telefono?: string | null;
    email?: string | null;
  };
  comprobante: {
    claveNumerica: string;
    consecutivo: string;
    fechaEmision: Date;
  };
  cliente: {
    nombre: string;
    identificacion: string;
    tipoIdentificacion: string;
    email?: string | null;
  };
  factura: {
    moneda: string;
    condicionVenta: string;
    medioPago: string;
    observaciones?: string | null;
    subtotal: number;
    totalDescuentos: number;
    totalImpuestos: number;
    total: number;
  };
  tituloDocumento?: string;
  detalles: Array<{
    numeroLinea: number;
    descripcion: string;
    cantidad: number;
    unidadMedida: string;
    precioUnitario: number;
    montoImpuesto: number;
    totalLinea: number;
  }>;
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const TEXT = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.45);
const HEADER = rgb(0.08, 0.28, 0.52);

function sanitize(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "");
}

function money(n: number, moneda: string): string {
  const sym = moneda === "USD" ? "$" : moneda === "EUR" ? "€" : "CRC ";
  return `${sym}${n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function drawLines(
  page: PDFPage,
  font: PDFFont,
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
  lineH: number
): number {
  for (const ln of lines) {
    page.drawText(ln, { x, y, size, font, color });
    y -= lineH;
  }
  return y;
}

export async function buildFacturaElectronicaPdf(input: FeFacturaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const logoImage: PDFImage | null = await embedBrandingLogo(pdf, input.logoFile ?? null);
  const logoBox = 76;
  let headerBottom = y;

  if (logoImage) {
    const maxW = logoBox;
    const maxH = logoBox;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: MARGIN,
      y: y - h,
      width: w,
      height: h,
    });
    headerBottom = y - h;
  }

  const titleX = logoImage ? MARGIN + logoBox + 14 : MARGIN;
  const titleY = logoImage ? y - 18 : y;

  page.drawText(sanitize(input.tituloDocumento ?? "FACTURA ELECTRÓNICA"), {
    x: titleX,
    y: titleY,
    size: 16,
    font: fontBold,
    color: HEADER,
  });

  y = logoImage ? headerBottom - 10 : y - 22;

  const emisorLines = [
    sanitize(input.emisor.razonSocial),
    sanitize(`Cédula: ${input.emisor.cedulaJuridica}`),
    sanitize(input.emisor.nombreComercial),
  ];
  if (input.emisor.telefono) emisorLines.push(sanitize(`Tel: ${input.emisor.telefono}`));
  if (input.emisor.email) emisorLines.push(sanitize(input.emisor.email));

  y = drawLines(page, font, emisorLines, MARGIN, y, 9, TEXT, 12);

  y -= 8;
  page.drawText(sanitize(`Consecutivo: ${input.comprobante.consecutivo}`), {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: TEXT,
  });
  y -= 12;
  page.drawText(sanitize(`Clave: ${input.comprobante.claveNumerica}`), {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: MUTED,
  });
  y -= 12;
  page.drawText(
    sanitize(
      `Fecha: ${format(input.comprobante.fechaEmision, "dd/MM/yyyy HH:mm", { locale: es })}`
    ),
    { x: MARGIN, y, size: 9, font, color: TEXT }
  );

  y -= 20;
  page.drawText(sanitize("Cliente"), { x: MARGIN, y, size: 10, font: fontBold, color: HEADER });
  y -= 14;
  y = drawLines(
    page,
    font,
    [
      sanitize(input.cliente.nombre),
      sanitize(`${input.cliente.tipoIdentificacion}: ${input.cliente.identificacion}`),
    ],
    MARGIN,
    y,
    9,
    TEXT,
    12
  );

  y -= 16;
  const colDesc = MARGIN;
  const colQty = 320;
  const colUnit = 380;
  const colTotal = 500;

  page.drawText("Descripción", { x: colDesc, y, size: 8, font: fontBold, color: MUTED });
  page.drawText("Cant.", { x: colQty, y, size: 8, font: fontBold, color: MUTED });
  page.drawText("P.Unit.", { x: colUnit, y, size: 8, font: fontBold, color: MUTED });
  page.drawText("Total", { x: colTotal, y, size: 8, font: fontBold, color: MUTED });
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: MUTED,
  });
  y -= 12;

  for (const line of input.detalles) {
    if (y < 120) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    const descLines = wrap(sanitize(line.descripcion), 42);
    page.drawText(String(line.numeroLinea), { x: MARGIN - 14, y, size: 8, font, color: MUTED });
    for (let i = 0; i < descLines.length; i++) {
      if (i === 0) {
        page.drawText(descLines[i]!, { x: colDesc, y, size: 8, font, color: TEXT });
        page.drawText(String(line.cantidad), { x: colQty, y, size: 8, font, color: TEXT });
        page.drawText(money(line.precioUnitario, input.factura.moneda), {
          x: colUnit,
          y,
          size: 8,
          font,
          color: TEXT,
        });
        page.drawText(money(line.totalLinea, input.factura.moneda), {
          x: colTotal,
          y,
          size: 8,
          font,
          color: TEXT,
        });
      } else {
        page.drawText(descLines[i]!, { x: colDesc, y, size: 8, font, color: TEXT });
      }
      y -= 11;
    }
    y -= 2;
  }

  y -= 8;
  const totalsX = 380;
  const drawTotal = (label: string, value: string, bold = false) => {
    page.drawText(label, { x: totalsX, y, size: 9, font: bold ? fontBold : font, color: TEXT });
    page.drawText(value, { x: colTotal, y, size: 9, font: bold ? fontBold : font, color: TEXT });
    y -= 14;
  };

  drawTotal("Subtotal:", money(input.factura.subtotal, input.factura.moneda));
  if (input.factura.totalDescuentos > 0) {
    drawTotal("Descuentos:", money(input.factura.totalDescuentos, input.factura.moneda));
  }
  drawTotal("Impuestos:", money(input.factura.totalImpuestos, input.factura.moneda));
  drawTotal("Total:", money(input.factura.total, input.factura.moneda), true);

  if (input.factura.observaciones?.trim()) {
    y -= 6;
    y = drawLines(
      page,
      font,
      wrap(sanitize(`Obs: ${input.factura.observaciones}`), 80),
      MARGIN,
      y,
      8,
      MUTED,
      11
    );
  }

  const qrUrl = feQrConsultaUrl(input.ambiente, input.comprobante.claveNumerica);
  const qrPng = await QRCode.toBuffer(qrUrl, { width: 120, margin: 1, type: "png" });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 90;
  page.drawImage(qrImage, {
    x: PAGE_W - MARGIN - qrSize,
    y: MARGIN,
    width: qrSize,
    height: qrSize,
  });
  page.drawText("Consulte en Hacienda", {
    x: PAGE_W - MARGIN - qrSize,
    y: MARGIN - 12,
    size: 7,
    font,
    color: MUTED,
  });

  return pdf.save();
}
