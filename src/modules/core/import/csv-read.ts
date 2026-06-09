import { normalizeHeaderKey } from "@/modules/core/import/xlsx-read";

export function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

export function detectCsvDelimiter(headerLine: string): ";" | "," {
  const semi = (headerLine.match(/;/g) || []).length;
  const comma = (headerLine.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

/** Parser CSV que respeta comillas y saltos de línea dentro de campos. */
export function parseCsvRecords(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (c === delim && !inQ) {
      row.push(cur.trim());
      cur = "";
    } else if (c === "\n" && !inQ) {
      row.push(cur.trim());
      cur = "";
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      cur += c;
    }
  }

  row.push(cur.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
}

/** Parser CSV mínimo (comillas dobles, delimitador ; o ,). Una sola línea física. */
export function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function emptyCsvToNull(v: string | undefined): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s || s === "-") return null;
  return s;
}

export function pickCsvHeader(headers: Record<string, number>, ...aliases: string[]): number | undefined {
  for (const a of aliases) {
    const k = normalizeHeaderKey(a);
    const idx = headers[k];
    if (idx !== undefined) return idx;
  }
  return undefined;
}

export type ParsedCsv = {
  headerCells: string[];
  headers: Record<string, number>;
  rows: string[][];
  delim: ";" | ",";
};

export function parseCsvText(text: string): ParsedCsv | { error: string } {
  const raw = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.trim()) {
    return { error: "El CSV no tiene datos" };
  }

  const headerEnd = raw.indexOf("\n");
  const headerSample = headerEnd >= 0 ? raw.slice(0, headerEnd) : raw;
  const delim = detectCsvDelimiter(headerSample);
  const allRows = parseCsvRecords(raw, delim);
  if (allRows.length < 2) {
    return { error: "El CSV no tiene datos" };
  }

  const headerCells = allRows[0];
  const headers: Record<string, number> = {};
  headerCells.forEach((h, i) => {
    const k = normalizeHeaderKey(h);
    if (k) headers[k] = i;
  });

  return { headerCells, headers, rows: allRows.slice(1), delim };
}

export function cellAt(row: string[], idx: number | undefined): string | null {
  if (idx === undefined) return null;
  return emptyCsvToNull(row[idx]);
}
