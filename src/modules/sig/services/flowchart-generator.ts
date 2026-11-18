import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { sigDocumentDir, storagePathForSigFile } from "./document-uploads";

export type FlowchartActivityInput = {
  name: string;
  responsible?: string | null;
  sortOrder?: number;
  code?: string;
};

export type FlowchartMeta = {
  fileName: string;
  mimeType: string;
  storagePath: string;
  fileSizeBytes: number;
};

export type RegenerateFlowchartResult =
  | { generated: false; reason: string }
  | ({ generated: true } & FlowchartMeta);

const MAX_LINE_CHARS = 28;
const NODE_WIDTH = 240;
const NODE_PAD_X = 14;
const NODE_PAD_Y = 12;
const LINE_HEIGHT = 16;
const TITLE_LINE_HEIGHT = 17;
const V_GAP = 24;
const COL_GAP = 44;
const CANVAS_PAD_X = 28;
const CANVAS_PAD_Y = 24;
const LEGEND_SWATCH = 12;
const LEGEND_TITLE_H = 22;
const LEGEND_CHAR_W = 7; // aprox. system-ui 12px
const LEGEND_MAX_CHARS = 34;
const LEGEND_MAX_LINES = 2;
const LEGEND_LINE_H = 14;
const LEGEND_ITEM_GAP_X = 18;
const LEGEND_ITEM_GAP_Y = 10;
const LEGEND_TEXT_GAP = 8;
const MAX_CANVAS_WIDTH = 2400;
const OTROS_DISTINCT_THRESHOLD = 10;
const START_END_H = 40;
const MAX_PER_COLUMN = 4;
const SINGLE_COLUMN_MAX_ACTIVITIES = 4;
const OTROS_COLOR = "#94a3b8";

/** Paleta estable por responsable. */
const RESPONSIBLE_COLORS = [
  "#1d4ed8", // blue
  "#047857", // emerald
  "#b45309", // amber
  "#b91c1c", // red
  "#0e7490", // cyan
  "#4338ca", // indigo
  "#c2410c", // orange
  "#0f766e", // teal
  "#a16207", // yellow-brown
  "#334155", // slate
] as const;

const NEUTRAL_FILL = "#e2e8f0";
const NEUTRAL_STROKE = "#64748b";
const START_END_FILL = "#0f172a";
const ARROW_STROKE = "#475569";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars = MAX_LINE_CHARS): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  const pushLongWord = (word: string) => {
    for (let i = 0; i < word.length; i += maxChars) {
      lines.push(word.slice(i, i + maxChars));
    }
  };

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      pushLongWord(word);
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function responsibleKey(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : "";
}

function activityLabel(activity: FlowchartActivityInput): string {
  const name = activity.name?.trim() || "Actividad";
  const code = activity.code?.trim();
  return code ? `${code} ${name}` : name;
}

/** Etiqueta de leyenda: máx. 2 líneas de ~34 chars; el resto se trunca con …. */
function formatLegendLabel(text: string): string[] {
  const lines = wrapText(text, LEGEND_MAX_CHARS);
  if (lines.length <= LEGEND_MAX_LINES) return lines;
  const second = lines[1] ?? "";
  const truncated =
    second.length >= LEGEND_MAX_CHARS - 1
      ? `${second.slice(0, LEGEND_MAX_CHARS - 1)}…`
      : `${second.slice(0, Math.max(1, LEGEND_MAX_CHARS - 1))}…`;
  return [lines[0] ?? "", truncated];
}

function estimateLegendTextWidth(lines: string[]): number {
  const maxLen = Math.max(1, ...lines.map((l) => l.length));
  return maxLen * LEGEND_CHAR_W;
}

type LegendEntry = { label: string; color: string };
type LegendItem = {
  label: string;
  color: string;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
};

type ResponsibleVisuals = {
  strokeForKey: (key: string) => string;
  fillForKey: (key: string) => string;
  legendEntries: LegendEntry[];
};

/**
 * Colores por responsable + entradas de leyenda.
 * Con >10 responsables distintos, los que aparecen una sola vez se agrupan en "Otros".
 */
function buildResponsibleVisuals(
  activities: FlowchartActivityInput[]
): ResponsibleVisuals {
  const counts = new Map<string, number>();
  const order: string[] = [];
  let hasEmpty = false;

  for (const a of activities) {
    const key = responsibleKey(a.responsible);
    if (!key) {
      hasEmpty = true;
      continue;
    }
    if (!counts.has(key)) order.push(key);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const useOtros = order.length > OTROS_DISTINCT_THRESHOLD;
  const singletonKeys = new Set(
    useOtros ? order.filter((k) => (counts.get(k) ?? 0) === 1) : []
  );
  const featuredKeys = order.filter((k) => !singletonKeys.has(k));

  const paletteIndex = new Map<string, number>();
  featuredKeys.forEach((k, i) => paletteIndex.set(k, i));

  const strokeForKey = (key: string): string => {
    if (!key) return NEUTRAL_STROKE;
    if (singletonKeys.has(key)) return OTROS_COLOR;
    const idx = paletteIndex.get(key) ?? 0;
    return RESPONSIBLE_COLORS[idx % RESPONSIBLE_COLORS.length]!;
  };

  const fillForKey = (key: string): string => {
    if (!key) return NEUTRAL_FILL;
    if (singletonKeys.has(key)) return `${OTROS_COLOR}22`;
    const stroke = strokeForKey(key);
    return `${stroke}22`;
  };

  const legendEntries: LegendEntry[] = featuredKeys.map((label) => ({
    label,
    color: strokeForKey(label),
  }));
  if (singletonKeys.size > 0) {
    legendEntries.push({ label: "Otros", color: OTROS_COLOR });
  }
  if (hasEmpty) {
    legendEntries.push({ label: "Sin responsable", color: NEUTRAL_STROKE });
  }

  return { strokeForKey, fillForKey, legendEntries };
}

/** Distribuye la leyenda en filas según el ancho disponible (sin solapes). */
function layoutLegend(
  entries: LegendEntry[],
  availableWidth: number
): { height: number; items: LegendItem[]; minContentWidth: number } {
  if (!entries.length) {
    return { height: 0, items: [], minContentWidth: 0 };
  }

  const usable = Math.max(80, availableWidth);
  const items: LegendItem[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;
  let maxX = 0;
  let minContentWidth = 0;

  for (const entry of entries) {
    const lines = formatLegendLabel(entry.label);
    const textW = estimateLegendTextWidth(lines);
    const w = LEGEND_SWATCH + LEGEND_TEXT_GAP + textW;
    const h = Math.max(LEGEND_SWATCH, lines.length * LEGEND_LINE_H);
    minContentWidth = Math.max(minContentWidth, w);

    if (cursorX > 0 && cursorX + w > usable) {
      cursorX = 0;
      cursorY += rowH + LEGEND_ITEM_GAP_Y;
      rowH = 0;
    }

    items.push({
      label: entry.label,
      color: entry.color,
      lines,
      x: cursorX,
      y: cursorY,
      w,
      h,
    });
    maxX = Math.max(maxX, cursorX + w);
    rowH = Math.max(rowH, h);
    cursorX += w + LEGEND_ITEM_GAP_X;
  }

  const height = LEGEND_TITLE_H + cursorY + rowH + 8;
  return {
    height,
    items,
    minContentWidth: Math.max(minContentWidth, maxX),
  };
}

type LayoutNode = {
  kind: "start" | "activity" | "end";
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  fill: string;
  stroke: string;
  responsibleLabel: string | null;
  /** Columna 0-based; pares bajan, impares suben. */
  col: number;
  /** true = flujo hacia abajo en la columna. */
  flowDown: boolean;
};

type PreparedNode = Omit<LayoutNode, "x" | "y" | "col" | "flowDown">;

function chunkNodes<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function columnStackHeight(nodes: PreparedNode[]): number {
  if (!nodes.length) return 0;
  return nodes.reduce((sum, n) => sum + n.h, 0) + V_GAP * (nodes.length - 1);
}

function connectorPath(from: LayoutNode, to: LayoutNode): string {
  const sameCol = from.col === to.col;

  if (sameCol && from.flowDown) {
    const x = from.x + from.w / 2;
    return `M ${x} ${from.y + from.h} L ${x} ${to.y}`;
  }

  if (sameCol && !from.flowDown) {
    // Flujo hacia arriba: sale por el tope del origen, entra por la base del destino.
    const x = from.x + from.w / 2;
    return `M ${x} ${from.y} L ${x} ${to.y + to.h}`;
  }

  // Cambio de columna (serpentina).
  if (from.flowDown && !to.flowDown) {
    // Fin de columna descendente (abajo) → inicio de columna ascendente (abajo).
    const y = Math.max(from.y + from.h, to.y + to.h) + V_GAP * 0.45;
    const x1 = from.x + from.w / 2;
    const x2 = to.x + to.w / 2;
    return `M ${x1} ${from.y + from.h} L ${x1} ${y} L ${x2} ${y} L ${x2} ${to.y + to.h}`;
  }

  // Fin de columna ascendente (arriba) → inicio de columna descendente (arriba).
  const y = Math.min(from.y, to.y) - V_GAP * 0.45;
  const x1 = from.x + from.w / 2;
  const x2 = to.x + to.w / 2;
  return `M ${x1} ${from.y} L ${x1} ${y} L ${x2} ${y} L ${x2} ${to.y}`;
}

/**
 * Construye un SVG: Inicio → actividades (sortOrder) → Fin.
 * Con >4 actividades usa serpentina (máx. 4 nodos/columna).
 * Puro: sin I/O. Devuelve null si no hay actividades.
 */
export function buildFlowchartSvg(activities: FlowchartActivityInput[]): string | null {
  if (!activities.length) return null;

  const sorted = [...activities].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  const visuals = buildResponsibleVisuals(sorted);

  const prepared: PreparedNode[] = [];

  prepared.push({
    kind: "start",
    w: NODE_WIDTH,
    h: START_END_H,
    lines: ["Inicio"],
    fill: START_END_FILL,
    stroke: START_END_FILL,
    responsibleLabel: null,
  });

  for (const activity of sorted) {
    const key = responsibleKey(activity.responsible);
    const stroke = visuals.strokeForKey(key);
    const fill = visuals.fillForKey(key);
    const lines = wrapText(activityLabel(activity));
    const respLine = key ? wrapText(key, MAX_LINE_CHARS) : [];
    const textH =
      lines.length * TITLE_LINE_HEIGHT +
      (respLine.length ? 4 + respLine.length * LINE_HEIGHT : 0);
    const h = NODE_PAD_Y * 2 + textH;

    prepared.push({
      kind: "activity",
      w: NODE_WIDTH,
      h,
      lines: [...lines, ...(respLine.length ? ["__RESP__", ...respLine] : [])],
      fill,
      stroke,
      responsibleLabel: key || null,
    });
  }

  prepared.push({
    kind: "end",
    w: NODE_WIDTH,
    h: START_END_H,
    lines: ["Fin"],
    fill: START_END_FILL,
    stroke: START_END_FILL,
    responsibleLabel: null,
  });

  const useSerpentine = sorted.length > SINGLE_COLUMN_MAX_ACTIVITIES;
  const columns = useSerpentine
    ? chunkNodes(prepared, MAX_PER_COLUMN)
    : [prepared];

  const colCount = columns.length;
  const stackHeights = columns.map(columnStackHeight);
  const contentHeight = Math.max(...stackHeights, 0);

  // Espacio extra arriba/abajo para los conectores horizontales entre columnas.
  const bridgePad = colCount > 1 ? Math.ceil(V_GAP * 0.55) : 0;

  const diagramWidth =
    CANVAS_PAD_X * 2 + colCount * NODE_WIDTH + Math.max(0, colCount - 1) * COL_GAP;

  // Ancho: al menos el del diagrama; crece si la leyenda lo exige, tope 2400.
  const legendProbe = layoutLegend(
    visuals.legendEntries,
    Math.max(diagramWidth, MAX_CANVAS_WIDTH) - CANVAS_PAD_X * 2
  );
  const width = Math.min(
    MAX_CANVAS_WIDTH,
    Math.max(diagramWidth, legendProbe.minContentWidth + CANVAS_PAD_X * 2)
  );
  const legend = layoutLegend(visuals.legendEntries, width - CANVAS_PAD_X * 2);

  const legendTop = CANVAS_PAD_Y;
  const contentTop = legendTop + (legend.height ? legend.height + 8 : 0) + bridgePad;
  const contentBottom = contentTop + contentHeight;
  const height = contentBottom + bridgePad + CANVAS_PAD_Y;

  const nodes: LayoutNode[] = [];

  columns.forEach((colNodes, colIdx) => {
    const flowDown = colIdx % 2 === 0;
    const colX = CANVAS_PAD_X + colIdx * (NODE_WIDTH + COL_GAP);
    const stackH = stackHeights[colIdx]!;

    if (flowDown) {
      let y = contentTop;
      for (const n of colNodes) {
        nodes.push({ ...n, x: colX, y, col: colIdx, flowDown });
        y += n.h + V_GAP;
      }
    } else {
      // Columna ascendente: el primer nodo de la secuencia queda abajo.
      let yCursor = contentTop + contentHeight;
      const placed: LayoutNode[] = [];
      for (const n of colNodes) {
        yCursor -= n.h;
        placed.push({ ...n, x: colX, y: yCursor, col: colIdx, flowDown });
        yCursor -= V_GAP;
      }
      nodes.push(...placed);
    }
  });

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Diagrama de flujo del procedimiento">`
  );
  parts.push(
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${ARROW_STROKE}"/></marker></defs>`
  );
  parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  // Leyenda superior (flujo en filas; altura dinámica)
  if (legend.items.length) {
    parts.push(
      `<text x="${CANVAS_PAD_X}" y="${legendTop + 14}" font-family="system-ui,Segoe UI,sans-serif" font-size="12" font-weight="600" fill="#334155">Responsables</text>`
    );
    for (const item of legend.items) {
      const lx = CANVAS_PAD_X + item.x;
      const ly = legendTop + LEGEND_TITLE_H + item.y;
      parts.push(
        `<rect data-legend-item="1" data-x="${lx}" data-y="${ly}" data-w="${item.w}" data-h="${item.h}" x="${lx}" y="${ly}" width="${LEGEND_SWATCH}" height="${LEGEND_SWATCH}" rx="2" fill="${item.color}"/>`
      );
      item.lines.forEach((line, li) => {
        parts.push(
          `<text x="${lx + LEGEND_SWATCH + LEGEND_TEXT_GAP}" y="${ly + 11 + li * LEGEND_LINE_H}" font-family="system-ui,Segoe UI,sans-serif" font-size="12" fill="#334155">${escapeXml(line)}</text>`
        );
      });
    }
  }

  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]!;
    const to = nodes[i + 1]!;
    parts.push(
      `<path d="${connectorPath(from, to)}" fill="none" stroke="${ARROW_STROKE}" stroke-width="2" marker-end="url(#arrow)"/>`
    );
  }

  for (const node of nodes) {
    const cx = node.x + node.w / 2;
    if (node.kind === "start" || node.kind === "end") {
      parts.push(
        `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${node.h / 2}" ry="${node.h / 2}" fill="${node.fill}" stroke="${node.stroke}"/>`
      );
      parts.push(
        `<text x="${cx}" y="${node.y + node.h / 2 + 5}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="14" font-weight="600" fill="#ffffff">${escapeXml(node.lines[0] ?? "")}</text>`
      );
      continue;
    }

    parts.push(
      `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="10" ry="10" fill="${node.fill}" stroke="${node.stroke}" stroke-width="2"/>`
    );

    let ty = node.y + NODE_PAD_Y + TITLE_LINE_HEIGHT - 4;
    let inResp = false;
    for (const line of node.lines) {
      if (line === "__RESP__") {
        inResp = true;
        ty += 4;
        continue;
      }
      if (inResp) {
        parts.push(
          `<text x="${cx}" y="${ty}" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="11" fill="${escapeXml(node.stroke)}">${escapeXml(line)}</text>`
        );
        ty += LINE_HEIGHT;
      } else {
        parts.push(
          `<text x="${node.x + NODE_PAD_X}" y="${ty}" text-anchor="start" font-family="system-ui,Segoe UI,sans-serif" font-size="13" font-weight="600" fill="#0f172a">${escapeXml(line)}</text>`
        );
        ty += TITLE_LINE_HEIGHT;
      }
    }
  }

  parts.push(`</svg>`);
  return parts.join("");
}

/** Escribe el SVG en disco bajo SIG_DOCUMENTS_ROOT/<documentId>/flowchart_<ts>_auto.svg */
export async function writeAutoFlowchartFile(
  documentId: string,
  activities: FlowchartActivityInput[]
): Promise<FlowchartMeta | null> {
  const svg = buildFlowchartSvg(activities);
  if (!svg) return null;

  const buffer = Buffer.from(svg, "utf8");
  const storedName = `flowchart_${Date.now()}_auto.svg`;
  const dir = sigDocumentDir(documentId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, path.basename(storedName)), buffer);
  const rel = storagePathForSigFile(documentId, storedName);

  return {
    fileName: storedName,
    mimeType: "image/svg+xml",
    storagePath: rel,
    fileSizeBytes: buffer.length,
  };
}

/**
 * Regenera el diagrama de la versión vigente a partir de sus actividades.
 * Actualiza los campos flowchart* del SigProcedureBody.
 */
export async function regenerateFlowchart(
  documentId: string
): Promise<RegenerateFlowchartResult> {
  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: {
      currentVersion: {
        include: {
          procedureBody: true,
          procedureActivities: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!doc) throw new Error("Documento no encontrado");
  if (doc.status === "OBSOLETE") throw new Error("El documento está obsoleto");

  const version = doc.currentVersion;
  if (!version) {
    return { generated: false, reason: "El documento no tiene versión vigente" };
  }

  const activities = version.procedureActivities;
  if (!activities.length) {
    return {
      generated: false,
      reason: "No hay actividades para generar el diagrama",
    };
  }

  const meta = await writeAutoFlowchartFile(
    documentId,
    activities.map((a) => ({
      name: a.name,
      responsible: a.responsible,
      sortOrder: a.sortOrder,
      code: a.code,
    }))
  );
  if (!meta) {
    return {
      generated: false,
      reason: "No hay actividades para generar el diagrama",
    };
  }

  await prisma.sigProcedureBody.upsert({
    where: { versionId: version.id },
    create: {
      versionId: version.id,
      flowchartFileName: meta.fileName,
      flowchartMimeType: meta.mimeType,
      flowchartStoragePath: meta.storagePath,
      flowchartFileSizeBytes: meta.fileSizeBytes,
    },
    update: {
      flowchartFileName: meta.fileName,
      flowchartMimeType: meta.mimeType,
      flowchartStoragePath: meta.storagePath,
      flowchartFileSizeBytes: meta.fileSizeBytes,
    },
  });

  return { generated: true, ...meta };
}
