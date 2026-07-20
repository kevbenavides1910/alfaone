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
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Paleta Alfa One (rojo / gris / negro) */
const INK = rgb(0.1, 0.1, 0.11);
const MUTED = rgb(0.38, 0.39, 0.42);
const LINE = rgb(0.82, 0.83, 0.85);
const PANEL = rgb(0.97, 0.97, 0.98);
const HEADER_BG = rgb(0.12, 0.12, 0.13);
const ACCENT = rgb(0.78, 0.1, 0.14);
const WHITE = rgb(1, 1, 1);
const ROW_ALT = rgb(0.965, 0.965, 0.97);

function sanitize(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "");
}

function money(n: number, moneda: string): string {
  const sym = moneda === "USD" ? "USD " : moneda === "EUR" ? "EUR " : "CRC ";
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

function rightText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  rightX: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - w, y, size, font, color });
}

function drawRoundedPanel(
  page: PDFPage,
  x: number,
  yBottom: number,
  w: number,
  h: number,
  fill: ReturnType<typeof rgb>
) {
  page.drawRectangle({
    x,
    y: yBottom,
    width: w,
    height: h,
    color: fill,
    borderColor: LINE,
    borderWidth: 0.8,
  });
}

function sectionLabel(page: PDFPage, fontBold: PDFFont, label: string, x: number, y: number) {
  page.drawText(sanitize(label.toUpperCase()), {
    x,
    y,
    size: 7.5,
    font: fontBold,
    color: ACCENT,
  });
  const labelW = fontBold.widthOfTextAtSize(sanitize(label.toUpperCase()), 7.5);
  page.drawRectangle({
    x,
    y: y - 3,
    width: Math.max(28, labelW),
    height: 1.5,
    color: ACCENT,
  });
}

export async function buildFacturaElectronicaPdf(input: FeFacturaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Barra superior de marca
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 8,
    width: PAGE_W,
    height: 8,
    color: ACCENT,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 44,
    width: PAGE_W,
    height: 36,
    color: HEADER_BG,
  });

  const logoImage: PDFImage | null = await embedBrandingLogo(pdf, input.logoFile ?? null);
  const title = sanitize(input.tituloDocumento ?? "FACTURA ELECTRÓNICA");

  if (logoImage) {
    const maxH = 26;
    const maxW = 90;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: MARGIN,
      y: PAGE_H - 38 - (maxH - h) / 2,
      width: w,
      height: h,
    });
  }

  page.drawText(title, {
    x: logoImage ? MARGIN + 100 : MARGIN,
    y: PAGE_H - 30,
    size: 13,
    font: fontBold,
    color: WHITE,
  });

  const fechaStr = format(input.comprobante.fechaEmision, "dd/MM/yyyy HH:mm", { locale: es });
  rightText(page, font, sanitize(fechaStr), PAGE_W - MARGIN, PAGE_H - 30, 9, WHITE);

  y = PAGE_H - 60;

  // Meta del documento (caja)
  const metaH = 52;
  drawRoundedPanel(page, MARGIN, y - metaH, CONTENT_W, metaH, PANEL);
  const metaPad = 10;
  let my = y - 14;
  page.drawText(sanitize("Consecutivo"), {
    x: MARGIN + metaPad,
    y: my,
    size: 7,
    font: fontBold,
    color: MUTED,
  });
  page.drawText(sanitize(input.comprobante.consecutivo), {
    x: MARGIN + metaPad,
    y: my - 12,
    size: 10,
    font: fontBold,
    color: INK,
  });

  page.drawText(sanitize("Clave numérica"), {
    x: MARGIN + 230,
    y: my,
    size: 7,
    font: fontBold,
    color: MUTED,
  });
  const claveLines = wrap(sanitize(input.comprobante.claveNumerica), 34);
  drawLinesSimple(page, font, claveLines, MARGIN + 230, my - 12, 7.5, INK, 9);

  page.drawText(sanitize("Ambiente"), {
    x: PAGE_W - MARGIN - 90,
    y: my,
    size: 7,
    font: fontBold,
    color: MUTED,
  });
  page.drawText(sanitize(input.ambiente === "PRODUCCION" ? "Producción" : "Pruebas"), {
    x: PAGE_W - MARGIN - 90,
    y: my - 12,
    size: 9,
    font: fontBold,
    color: ACCENT,
  });

  y = y - metaH - 16;

  // Emisor | Cliente
  const colW = (CONTENT_W - 10) / 2;
  const boxH = 78;
  drawRoundedPanel(page, MARGIN, y - boxH, colW, boxH, WHITE);
  drawRoundedPanel(page, MARGIN + colW + 10, y - boxH, colW, boxH, WHITE);

  sectionLabel(page, fontBold, "Emisor", MARGIN + 10, y - 14);
  let ey = y - 28;
  ey = drawLinesSimple(
    page,
    fontBold,
    wrap(sanitize(input.emisor.razonSocial), 38),
    MARGIN + 10,
    ey,
    8.5,
    INK,
    11
  );
  drawLinesSimple(
    page,
    font,
    [
      sanitize(`Cédula: ${input.emisor.cedulaJuridica}`),
      ...(input.emisor.nombreComercial && input.emisor.nombreComercial !== input.emisor.razonSocial
        ? [sanitize(input.emisor.nombreComercial)]
        : []),
      ...(input.emisor.telefono ? [sanitize(`Tel: ${input.emisor.telefono}`)] : []),
      ...(input.emisor.email ? [sanitize(input.emisor.email)] : []),
    ],
    MARGIN + 10,
    ey,
    7.5,
    MUTED,
    10
  );

  sectionLabel(page, fontBold, "Cliente", MARGIN + colW + 20, y - 14);
  let cy = y - 28;
  cy = drawLinesSimple(
    page,
    fontBold,
    wrap(sanitize(input.cliente.nombre), 38),
    MARGIN + colW + 20,
    cy,
    8.5,
    INK,
    11
  );
  drawLinesSimple(
    page,
    font,
    [
      sanitize(`${input.cliente.tipoIdentificacion}: ${input.cliente.identificacion}`),
      ...(input.cliente.email ? [sanitize(input.cliente.email)] : []),
    ],
    MARGIN + colW + 20,
    cy,
    7.5,
    MUTED,
    10
  );

  y = y - boxH - 12;

  // Condiciones de venta
  const condH = 28;
  drawRoundedPanel(page, MARGIN, y - condH, CONTENT_W, condH, PANEL);
  const condY = y - 18;
  const condParts = [
    `Moneda: ${sanitize(input.factura.moneda)}`,
    `Condición: ${sanitize(input.factura.condicionVenta)}`,
    `Pago: ${sanitize(input.factura.medioPago)}`,
  ];
  let cx = MARGIN + 12;
  for (const part of condParts) {
    page.drawText(part, { x: cx, y: condY, size: 8, font, color: INK });
    cx += font.widthOfTextAtSize(part, 8) + 28;
  }
  y = y - condH - 14;

  // Tabla de líneas
  const colLine = MARGIN + 6;
  const colDesc = MARGIN + 28;
  const colQtyRight = MARGIN + 360;
  const colUnitRight = MARGIN + 455;
  const colTotalRight = PAGE_W - MARGIN - 8;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 18,
      width: CONTENT_W,
      height: 22,
      color: HEADER_BG,
    });
    const hy = y - 12;
    page.drawText("#", { x: colLine, y: hy, size: 8, font: fontBold, color: WHITE });
    page.drawText(sanitize("Descripción"), { x: colDesc, y: hy, size: 8, font: fontBold, color: WHITE });
    rightText(page, fontBold, "Cant.", colQtyRight, hy, 8, WHITE);
    rightText(page, fontBold, "P. unitario", colUnitRight, hy, 8, WHITE);
    rightText(page, fontBold, "Total", colTotalRight, hy, 8, WHITE);
    y -= 26;
  };

  drawTableHeader();

  let rowIndex = 0;
  for (const line of input.detalles) {
    const descLines = wrap(sanitize(line.descripcion), 44);
    const rowH = Math.max(16, descLines.length * 11 + 6);

    if (y - rowH < 150) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: ACCENT });
      drawTableHeader();
    }

    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: MARGIN,
        y: y - rowH + 4,
        width: CONTENT_W,
        height: rowH,
        color: ROW_ALT,
      });
    }

    const rowTop = y;
    page.drawText(String(line.numeroLinea), {
      x: colLine,
      y: rowTop - 2,
      size: 8,
      font,
      color: MUTED,
    });

    for (let i = 0; i < descLines.length; i++) {
      const ly = rowTop - 2 - i * 11;
      page.drawText(descLines[i]!, { x: colDesc, y: ly, size: 8, font, color: INK });
      if (i === 0) {
        rightText(page, font, String(line.cantidad), colQtyRight, ly, 8, INK);
        rightText(page, font, money(line.precioUnitario, input.factura.moneda), colUnitRight, ly, 8, INK);
        rightText(page, fontBold, money(line.totalLinea, input.factura.moneda), colTotalRight, ly, 8, INK);
      }
    }

    y -= rowH;
    page.drawLine({
      start: { x: MARGIN, y: y + 3 },
      end: { x: PAGE_W - MARGIN, y: y + 3 },
      thickness: 0.4,
      color: LINE,
    });
    rowIndex += 1;
  }

  y -= 10;

  // Totales
  const totalsW = 220;
  const totalsX = PAGE_W - MARGIN - totalsW;
  const totalsRows =
    3 + (input.factura.totalDescuentos > 0 ? 1 : 0);
  const totalsH = 18 + totalsRows * 16 + 10;
  if (y - totalsH < 130) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  drawRoundedPanel(page, totalsX, y - totalsH, totalsW, totalsH, PANEL);
  let ty = y - 16;
  const drawTot = (label: string, value: string, emphasize = false) => {
    page.drawText(label, {
      x: totalsX + 12,
      y: ty,
      size: emphasize ? 10 : 9,
      font: emphasize ? fontBold : font,
      color: emphasize ? INK : MUTED,
    });
    rightText(
      page,
      emphasize ? fontBold : font,
      value,
      totalsX + totalsW - 12,
      ty,
      emphasize ? 10 : 9,
      emphasize ? ACCENT : INK
    );
    ty -= 16;
  };

  drawTot("Subtotal", money(input.factura.subtotal, input.factura.moneda));
  if (input.factura.totalDescuentos > 0) {
    drawTot("Descuentos", money(input.factura.totalDescuentos, input.factura.moneda));
  }
  drawTot("Impuestos", money(input.factura.totalImpuestos, input.factura.moneda));
  page.drawLine({
    start: { x: totalsX + 10, y: ty + 8 },
    end: { x: totalsX + totalsW - 10, y: ty + 8 },
    thickness: 0.8,
    color: LINE,
  });
  ty -= 2;
  drawTot("TOTAL", money(input.factura.total, input.factura.moneda), true);

  // Observaciones a la izquierda de totales
  if (input.factura.observaciones?.trim()) {
    const obsX = MARGIN;
    const obsW = totalsX - MARGIN - 12;
    const obsLines = wrap(sanitize(input.factura.observaciones), 48);
    const obsH = 28 + obsLines.length * 11;
    drawRoundedPanel(page, obsX, y - Math.max(obsH, totalsH), obsW, Math.max(obsH, totalsH), WHITE);
    sectionLabel(page, fontBold, "Observaciones", obsX + 10, y - 14);
    drawLinesSimple(page, font, obsLines, obsX + 10, y - 30, 8, INK, 11);
  }

  y = y - Math.max(totalsH, 70) - 16;

  // Pie: QR + nota legal
  const qrUrl = feQrConsultaUrl(input.ambiente, input.comprobante.claveNumerica);
  const qrPng = await QRCode.toBuffer(qrUrl, {
    width: 140,
    margin: 1,
    type: "png",
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 78;
  const footerTop = 108;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: footerTop,
    color: PANEL,
  });
  page.drawRectangle({
    x: 0,
    y: footerTop - 2,
    width: PAGE_W,
    height: 2,
    color: ACCENT,
  });

  page.drawImage(qrImage, {
    x: PAGE_W - MARGIN - qrSize,
    y: 22,
    width: qrSize,
    height: qrSize,
  });

  page.drawText(sanitize("Consulta en Hacienda"), {
    x: PAGE_W - MARGIN - qrSize - 4,
    y: 12,
    size: 7,
    font: fontBold,
    color: MUTED,
  });

  page.drawText(sanitize("Documento tributario electrónico"), {
    x: MARGIN,
    y: 78,
    size: 9,
    font: fontBold,
    color: INK,
  });
  const legal = wrap(
    sanitize(
      "Comprobante generado electrónicamente conforme a la normativa de la Dirección General de Tributación. " +
        "Valide la clave numérica con el código QR o en el portal de consulta de Hacienda."
    ),
    72
  );
  drawLinesSimple(page, font, legal, MARGIN, 62, 7.5, MUTED, 10);

  return pdf.save();
}

function drawLinesSimple(
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
