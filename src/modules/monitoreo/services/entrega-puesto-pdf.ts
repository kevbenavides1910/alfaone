import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ENTREGA_PUESTO_GROUPS } from "@/modules/monitoreo/business/entrega-puesto";
import type { EntregaPuestoDto } from "@/modules/monitoreo/services/entrega-puesto";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;

const TEXT = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.35, 0.4, 0.48);
const GOLD = rgb(0.72, 0.52, 0.12);
const OK = rgb(0.1, 0.45, 0.28);
const FALLA = rgb(0.7, 0.15, 0.15);
const LINE = rgb(0.82, 0.84, 0.88);

const STATUS_LABEL: Record<string, string> = {
  OK: "En orden / en línea",
  FALLA: "Falla / pendiente",
  NA: "No aplica",
};

function pdfText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    .replace(/[^\n\r\t\u0020-\u00FF]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of pdfText(text).split(/\r?\n/)) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of para.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

export async function buildEntregaPuestoPdf(row: EntregaPuestoDto): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };

  const ensure = (need: number) => {
    if (y - need < MARGIN) newPage();
  };

  const draw = (
    text: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const color = opts.color ?? TEXT;
    const x = opts.x ?? MARGIN;
    const maxWidth = opts.maxWidth ?? PAGE_W - MARGIN - x;
    for (const line of wrap(text, f, size, maxWidth)) {
      ensure(size + 4);
      if (line) page.drawText(line, { x, y: y - size, size, font: f, color });
      y -= size + 3;
    }
  };

  page.drawRectangle({ x: MARGIN, y: y - 4, width: 86, height: 3, color: GOLD });
  y -= 16;
  draw("GRUPO ALFA", { size: 16, font: bold, color: GOLD });
  draw("Centro de Monitoreo", { size: 11, font: bold });
  draw("Checklist de entrega y recepción de puesto", { size: 10, color: MUTED });
  y -= 6;

  draw(`Fecha: ${row.fecha}    Hora: ${row.hora}`, { size: 11, font: bold });
  draw(`Operador que entrega: ${row.saliente}`, { size: 11 });
  draw(`Operador que recibe: ${row.entrante}`, { size: 11 });
  draw(`Resultado: ${row.resultado}`, { size: 11, font: bold });
  y -= 8;

  for (const [index, [group, labels]] of ENTREGA_PUESTO_GROUPS.entries()) {
    ensure(28);
    draw(`${index + 1}. ${group}`, { size: 12, font: bold });
    y -= 2;
    for (const label of labels) {
      const check = row.checks.find((c) => c.group === group && c.label === label);
      const status = check?.status ?? "";
      const statusText = STATUS_LABEL[status] ?? "Sin verificar";
      const color = status === "OK" ? OK : status === "FALLA" ? FALLA : MUTED;
      ensure(16);
      const labelWidth = PAGE_W - MARGIN * 2 - 130;
      const labelLines = wrap(label, font, 9, labelWidth);
      const rowH = labelLines.length * 12 + 4;
      page.drawLine({
        start: { x: MARGIN, y: y - rowH + 6 },
        end: { x: PAGE_W - MARGIN, y: y - rowH + 6 },
        thickness: 0.4,
        color: LINE,
      });
      let lineY = y;
      for (const line of labelLines) {
        page.drawText(pdfText(line), { x: MARGIN, y: lineY - 9, size: 9, font, color: TEXT });
        lineY -= 12;
      }
      const statusWidth = bold.widthOfTextAtSize(pdfText(statusText), 9);
      page.drawText(pdfText(statusText), {
        x: PAGE_W - MARGIN - statusWidth,
        y: y - 9,
        size: 9,
        font: bold,
        color,
      });
      y -= rowH;
    }
    y -= 8;
  }

  ensure(24);
  draw("Observaciones, fallas y pendientes", { size: 12, font: bold });
  draw(row.observaciones.trim() || "Sin observaciones.", { size: 10 });
  y -= 8;
  draw(
    "El operador entrante confirma el estado de los sistemas y recibe las novedades documentadas. El registro es una constancia operativa, no una firma digital.",
    { size: 8, color: MUTED },
  );
  draw(`Registrado por ${row.createdByName}.`, { size: 8, color: MUTED });

  const pages = doc.getPages();
  pages.forEach((p: PDFPage, i) => {
    p.drawText(`Grupo Alfa  ·  Entrega de puesto  ·  ${i + 1}/${pages.length}`, {
      x: MARGIN,
      y: 22,
      size: 8,
      font,
      color: MUTED,
    });
  });

  return doc.save();
}
