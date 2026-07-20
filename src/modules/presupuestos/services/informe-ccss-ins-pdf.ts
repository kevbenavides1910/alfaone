import { PDFDocument, rgb } from "pdf-lib";
import {
  extractCcssCedulas,
  extractInsCedulas,
  normalizeCedulaDigits,
} from "@/modules/presupuestos/business/cedula-normalize";
import { loadPdfJsForNode } from "@/modules/presupuestos/services/pdfjs-node-setup";
import { preparePdfBufferForEdit } from "@/modules/presupuestos/services/pdf-decrypt-for-edit";

export type InformeReportType = "auto" | "ccss" | "ins";

export type HighlightRect = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cedulaDigits: string;
  label: string;
};

export type InformeHighlightResult = {
  reportType: "ccss" | "ins";
  pdfBytes: Uint8Array;
  stats: {
    pdfCedulasFound: number;
    contractEmployees: number;
    highlighted: number;
    notInContract: number;
    notInNaf: number;
  };
  highlightedEmployees: {
    cedulaDigits: string;
    nombre: string | null;
    pages: number[];
  }[];
  skippedCedulas: string[];
};

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

type PdfJsPageViewport = {
  width: number;
  transform: number[];
};

type PdfJsUtil = {
  transform: (m1: number[], m2: number[]) => number[];
};

function asTextItems(items: unknown[]): PdfTextItem[] {
  return items.filter(
    (i): i is PdfTextItem =>
      typeof i === "object" &&
      i !== null &&
      "str" in i &&
      typeof (i as PdfTextItem).str === "string",
  );
}

function detectReportType(text: string, requested: InformeReportType): "ccss" | "ins" {
  if (requested === "ccss" || requested === "ins") return requested;
  const upper = text.toUpperCase();
  if (upper.includes("CAJA COSTARRICENSE") || upper.includes("PLANILLA MENSUAL")) return "ccss";
  if (upper.includes("NO_IDENTIFICACION") || upper.includes("TIPO_JORNADA")) return "ins";
  if (extractCcssCedulas(text).length > extractInsCedulas(text).length) return "ccss";
  return "ins";
}

function isCcssCedulaItem(str: string): boolean {
  return /^[0-9]-\d{7,11}$/.test(str.trim());
}

function isInsCedulaItem(str: string): boolean {
  return /^\d{9}$/.test(str.trim());
}

function itemPos(
  item: PdfTextItem,
  viewport: PdfJsPageViewport,
  pdfjsUtil: PdfJsUtil,
) {
  const tx = pdfjsUtil.transform(viewport.transform, item.transform);
  const fontHeight = Math.hypot(item.transform[2], item.transform[3]) || 7;
  return {
    x: tx[4],
    y: tx[5],
    fontHeight,
    width: item.width,
  };
}

function lineKey(y: number): number {
  return Math.round(y * 10) / 10;
}

function rectFromPositions(
  positions: ReturnType<typeof itemPos>[],
  pageWidth: number,
  fullWidth = true,
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minTop = Infinity;
  let maxBottom = -Infinity;

  for (const p of positions) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x + p.width);
    // Viewport pdf.js: origen arriba-izquierda, Y crece hacia abajo.
    minTop = Math.min(minTop, p.y - p.fontHeight);
    maxBottom = Math.max(maxBottom, p.y + 1);
  }

  const padX = 2;
  const padY = 1;
  return {
    x: fullWidth ? 26 : minX - padX,
    y: minTop - padY,
    width: fullWidth ? pageWidth - 52 : maxX - minX + padX * 2,
    height: Math.max(maxBottom - minTop + padY * 2, 5),
  };
}

/** Convierte rect en coords viewport (Y↓) a pdf-lib (Y↑). */
function viewportRectToPdfLib(
  rect: { x: number; y: number; width: number; height: number },
  pageHeight: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.x,
    y: pageHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

function findCcssHighlights(
  items: PdfTextItem[],
  viewport: PdfJsPageViewport,
  pageIndex: number,
  highlightSet: Set<string>,
  employeeNames: Map<string, string | null>,
  pdfjsUtil: PdfJsUtil,
): HighlightRect[] {
  const rects: HighlightRect[] = [];
  const pageWidth = viewport.width;
  const positioned = items.map((item) => ({ item, pos: itemPos(item, viewport, pdfjsUtil) }));

  const allCedulaYs = positioned
    .filter(({ item }) => isCcssCedulaItem(item.str.trim()))
    .map(({ pos }) => lineKey(pos.y))
    .sort((a, b) => b - a);

  for (const { item, pos: cedPos } of positioned) {
    const text = item.str.trim();
    if (!isCcssCedulaItem(text)) continue;
    const digits = normalizeCedulaDigits(text);
    if (!highlightSet.has(digits)) continue;

    const cedKey = lineKey(cedPos.y);
    // CCSS: cédula (x~38) y nombre (x~95) van en la misma línea (Δy ~1pt).
    // Las filas van separadas ~13pt; un nombre ~12pt arriba es de otra persona.
    const rowPositions = positioned
      .filter(({ item: rowItem, pos }) => {
        if (pos.x < 26 || pos.x > 420) return false;
        const dy = Math.abs(pos.y - cedPos.y);
        if (isCcssCedulaItem(rowItem.str.trim()) && rowItem.str.trim() !== text) {
          return dy <= 1.5;
        }
        return dy <= 4;
      })
      .map(({ pos }) => pos);

    const box = rectFromPositions(
      rowPositions.length > 0 ? rowPositions : [cedPos],
      pageWidth,
      true,
    );

    const lineIndex = allCedulaYs.indexOf(cedKey);
    const nextLineKey = lineIndex >= 0 ? allCedulaYs[lineIndex + 1] : undefined;
    if (nextLineKey != null) {
      const maxHeight = (cedKey - nextLineKey) * 0.85;
      if (box.height > maxHeight) {
        box.height = Math.max(maxHeight, 5);
      }
    }

    rects.push({
      pageIndex,
      ...box,
      cedulaDigits: digits,
      label: employeeNames.get(digits) ?? text,
    });
  }

  return rects;
}

function findInsHighlights(
  items: PdfTextItem[],
  viewport: PdfJsPageViewport,
  pageIndex: number,
  highlightSet: Set<string>,
  employeeNames: Map<string, string | null>,
  pdfjsUtil: PdfJsUtil,
): HighlightRect[] {
  const rects: HighlightRect[] = [];
  const pageWidth = viewport.width;
  const positioned = items.map((item) => ({ item, pos: itemPos(item, viewport, pdfjsUtil) }));

  // Todas las Y de cédulas en la página (para limitar altura del rectángulo).
  const allCedulaYs = positioned
    .filter(({ item }) => isInsCedulaItem(item.str.trim()))
    .map(({ pos }) => lineKey(pos.y))
    .sort((a, b) => b - a);

  for (const { item, pos: cedPos } of positioned) {
    const text = item.str.trim();
    if (!isInsCedulaItem(text)) continue;
    const digits = normalizeCedulaDigits(text);
    if (!highlightSet.has(digits)) continue;

    const cedKey = lineKey(cedPos.y);
    const rowPositions = positioned
      .filter(({ item: rowItem, pos }) => {
        if (pos.x < 20 || pos.x > pageWidth - 20) return false;
        const dy = Math.abs(pos.y - cedPos.y);
        if (dy <= 2) return true;
        if (dy <= 5 && !isInsCedulaItem(rowItem.str.trim())) return true;
        return false;
      })
      .map(({ pos }) => pos);

    const box = rectFromPositions(
      rowPositions.length > 0 ? rowPositions : [cedPos],
      pageWidth,
      true,
    );

    const lineIndex = allCedulaYs.indexOf(cedKey);
    const nextLineKey = lineIndex >= 0 ? allCedulaYs[lineIndex + 1] : undefined;
    if (nextLineKey != null) {
      const maxHeight = (cedKey - nextLineKey) * 0.88;
      if (box.height > maxHeight) {
        box.height = Math.max(maxHeight, 5);
      }
    }

    rects.push({
      pageIndex,
      ...box,
      cedulaDigits: digits,
      label: employeeNames.get(digits) ?? text,
    });
  }

  return rects;
}

export async function buildHighlightedInformePdf(input: {
  pdfBuffer: Buffer;
  reportType: InformeReportType;
  contractCedulaDigits: Set<string>;
  employeeNames: Map<string, string | null>;
}): Promise<InformeHighlightResult> {
  const pdfjs = await loadPdfJsForNode();
  const editableBuffer = await preparePdfBufferForEdit(input.pdfBuffer);
  // pdfjs puede transferir/detach el ArrayBuffer; pdf-lib necesita una copia independiente.
  const pdfjsData = new Uint8Array(editableBuffer);
  const pdfLibData = Buffer.from(editableBuffer);

  const parsed = await pdfjs.getDocument({ data: pdfjsData, useSystemFonts: true }).promise;

  let fullText = "";
  const allRects: HighlightRect[] = [];

  for (let pageNum = 1; pageNum <= parsed.numPages; pageNum++) {
    const page = await parsed.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = asTextItems(textContent.items as unknown[]);
    fullText += items.map((i) => i.str).join(" ") + "\n";
  }

  const detectedType = detectReportType(fullText, input.reportType);
  const pdfCedulas =
    detectedType === "ccss"
      ? [...new Set(extractCcssCedulas(fullText).map(normalizeCedulaDigits))]
      : [...new Set(extractInsCedulas(fullText).map(normalizeCedulaDigits))];

  const highlightSet = new Set<string>();
  for (const d of pdfCedulas) {
    if (input.contractCedulaDigits.has(d)) highlightSet.add(d);
  }

  for (let pageNum = 1; pageNum <= parsed.numPages; pageNum++) {
    const page = await parsed.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const items = asTextItems(textContent.items as unknown[]);

    const pageRects =
      detectedType === "ccss"
        ? findCcssHighlights(
            items,
            viewport,
            pageNum - 1,
            highlightSet,
            input.employeeNames,
            pdfjs.Util,
          )
        : findInsHighlights(
            items,
            viewport,
            pageNum - 1,
            highlightSet,
            input.employeeNames,
            pdfjs.Util,
          );
    allRects.push(...pageRects);
  }

  const pdfDoc = await PDFDocument.load(pdfLibData);
  const pages = pdfDoc.getPages();
  const yellow = rgb(1, 0.92, 0.2);

  for (const rect of allRects) {
    const page = pages[rect.pageIndex];
    if (!page) continue;
    const pdfRect = viewportRectToPdfLib(rect, page.getHeight());
    page.drawRectangle({
      x: pdfRect.x,
      y: pdfRect.y,
      width: pdfRect.width,
      height: pdfRect.height,
      color: yellow,
      opacity: 0.42,
      borderWidth: 0,
    });
  }

  const highlightedByCedula = new Map<string, { nombre: string | null; pages: Set<number> }>();
  for (const rect of allRects) {
    const cur = highlightedByCedula.get(rect.cedulaDigits) ?? {
      nombre: input.employeeNames.get(rect.cedulaDigits) ?? rect.label,
      pages: new Set<number>(),
    };
    cur.pages.add(rect.pageIndex + 1);
    highlightedByCedula.set(rect.cedulaDigits, cur);
  }

  const highlightedEmployees = [...highlightedByCedula.entries()].map(([cedulaDigits, v]) => ({
    cedulaDigits,
    nombre: v.nombre,
    pages: [...v.pages].sort((a, b) => a - b),
  }));

  const skippedCedulas = pdfCedulas.filter((d) => !highlightSet.has(d));

  return {
    reportType: detectedType,
    pdfBytes: await pdfDoc.save({ useObjectStreams: false }),
    stats: {
      pdfCedulasFound: pdfCedulas.length,
      contractEmployees: input.contractCedulaDigits.size,
      highlighted: highlightedByCedula.size,
      notInContract: skippedCedulas.length,
      notInNaf: 0,
    },
    highlightedEmployees,
    skippedCedulas: skippedCedulas.slice(0, 50),
  };
}
