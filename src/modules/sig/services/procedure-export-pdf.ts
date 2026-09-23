import type { ProcedureContentView } from "./procedure-content";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function sanitize(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF\n\r\t]/g, "");
}

function wrapLines(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const paragraphs = sanitize(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
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
  return lines;
}

/** PDF del procedimiento en formato Alfa (copia controlada). */
export async function buildProcedureAlfaPdf(
  view: ProcedureContentView
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 48;
  const maxW = PAGE_W - MARGIN * 2;
  const TEXT = rgb(0.12, 0.12, 0.14);
  const MUTED = rgb(0.4, 0.4, 0.42);
  const ACCENT = rgb(0.55, 0.05, 0.1);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN + 24) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const drawText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {}
  ) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? fontBold : font;
    const color = opts.color ?? TEXT;
    const indent = opts.indent ?? 0;
    const lines = wrapLines(text, f, size, maxW - indent);
    for (const line of lines) {
      ensureSpace(size + 4);
      if (line) {
        page.drawText(line, {
          x: MARGIN + indent,
          y: y - size,
          size,
          font: f,
          color,
        });
      }
      y -= size + 3;
    }
  };

  drawText("COPIA CONTROLADA — Sistema de Gestion (Alfa One)", {
    size: 9,
    bold: true,
    color: ACCENT,
  });
  y -= 6;
  drawText(`${view.code} — ${view.title}`, { size: 14, bold: true });
  drawText(
    [
      view.documentType.name,
      view.versionLabel ? `Version ${view.versionLabel}` : null,
      view.versionStatus ? `Estado ${view.versionStatus}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    { size: 9, color: MUTED }
  );
  y -= 10;

  const sections =
    view.sections.length > 0
      ? view.sections
      : [
          view.body?.objective
            ? {
                number: "1",
                title: "Objetivo General",
                kind: "prose" as const,
                body: view.body.objective,
              }
            : null,
          view.body?.scope
            ? {
                number: "2",
                title: "Alcance",
                kind: "prose" as const,
                body: view.body.scope,
              }
            : null,
          view.body?.definitions
            ? {
                number: "4",
                title: "Definiciones",
                kind: "prose" as const,
                body: view.body.definitions,
              }
            : null,
          view.body?.responsibilities
            ? {
                number: "5",
                title: "Responsabilidades",
                kind: "prose" as const,
                body: view.body.responsibilities,
              }
            : null,
        ].filter(Boolean) as Array<{
          number: string | null;
          title: string;
          kind: string;
          body: string;
        }>;

  for (const section of sections) {
    if (section.kind === "flowchart") {
      ensureSpace(40);
      drawText(
        `${section.number ? `${section.number}. ` : ""}${section.title}`,
        { size: 11, bold: true }
      );
      drawText(
        view.flowchartUrl
          ? "(Diagrama de flujo disponible en la ficha digital del SIG.)"
          : "(Sin diagrama de flujo adjunto.)",
        { size: 9, color: MUTED }
      );
      y -= 8;
      continue;
    }
    if (section.kind === "activities") {
      ensureSpace(40);
      drawText(
        `${section.number ? `${section.number}. ` : ""}${section.title}`,
        { size: 11, bold: true }
      );
      const acts = view.activities;
      if (!acts.length) {
        drawText("Sin actividades registradas.", { size: 9, color: MUTED });
      } else {
        for (const a of acts) {
          ensureSpace(48);
          drawText(`${a.code}  ${a.name}`, { size: 9, bold: true });
          if (a.description) drawText(a.description, { size: 9, indent: 10 });
          const meta = [
            a.documents ? `Documentos: ${a.documents}` : null,
            a.responsible ? `Responsable: ${a.responsible}` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          if (meta) drawText(meta, { size: 8, color: MUTED, indent: 10 });
          y -= 4;
        }
      }
      y -= 8;
      continue;
    }

    if (!section.body?.trim() && section.kind === "prose") continue;
    ensureSpace(36);
    drawText(
      `${section.number ? `${section.number}. ` : ""}${section.title}`,
      { size: 11, bold: true }
    );
    if (section.body?.trim()) {
      drawText(section.body, { size: 9 });
    }
    y -= 8;
  }

  if (!sections.length && view.stages.length) {
    drawText("Etapas", { size: 11, bold: true });
    for (const s of view.stages) {
      drawText(`${s.sortOrder + 1}. ${s.title}`, { size: 9, bold: true });
      if (s.body) drawText(s.body, { size: 9, indent: 8 });
      y -= 4;
    }
  }

  ensureSpace(40);
  y -= 8;
  drawText(
    `Generado desde Alfa One SIG · ${new Date().toISOString().slice(0, 10)} · Uso interno`,
    { size: 8, color: MUTED }
  );

  return doc.save();
}
