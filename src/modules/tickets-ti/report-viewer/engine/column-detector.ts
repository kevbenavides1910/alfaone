import type { ColumnDataType, ColumnMeta, DataRow } from "../types";

const DATE_RE = /^(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/;
const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;
const CURRENCY_RE = /^[$€£]?\s?-?\d[\d.,]*$/;
const PERCENT_RE = /^-?\d+([.,]\d+)?\s?%$/;

function normalizeLabel(label: string, index: number): string {
  const trimmed = label?.trim();
  return trimmed || `Columna ${index + 1}`;
}

function makeColumnId(index: number): string {
  return `col_${index}`;
}

/** Detecta el tipo predominante de una columna a partir de una muestra. */
export function detectColumnType(values: unknown[]): ColumnDataType {
  const sample = values
    .filter((v) => v != null && String(v).trim() !== "")
    .slice(0, 200)
    .map((v) => String(v).trim());

  if (sample.length === 0) return "text";

  let boolCount = 0;
  let percentCount = 0;
  let currencyCount = 0;
  let decimalCount = 0;
  let intCount = 0;
  let dateCount = 0;
  let timeCount = 0;
  let datetimeCount = 0;

  for (const s of sample) {
    const lower = s.toLowerCase();
    if (["true", "false", "sí", "si", "no", "1", "0", "yes", "no"].includes(lower)) boolCount++;
    if (PERCENT_RE.test(s)) percentCount++;
    if (CURRENCY_RE.test(s)) currencyCount++;
    if (TIME_RE.test(s) && !DATE_RE.test(s)) timeCount++;
    if (DATE_RE.test(s) && s.includes(":")) datetimeCount++;
    else if (DATE_RE.test(s)) dateCount++;

    const num = Number(s.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (!Number.isNaN(num) && /^-?\d+([.,]\d+)?$/.test(s.replace(/[^\d.,-]/g, ""))) {
      if (s.includes(".") || s.includes(",")) decimalCount++;
      else intCount++;
    }
  }

  const n = sample.length;
  if (boolCount / n > 0.8) return "boolean";
  if (percentCount / n > 0.5) return "percent";
  if (currencyCount / n > 0.5) return "currency";
  if (datetimeCount / n > 0.5) return "datetime";
  if (dateCount / n > 0.5) return "date";
  if (timeCount / n > 0.5) return "time";
  if (decimalCount / n > 0.5) return "decimal";
  if (intCount / n > 0.5) return "number";
  return "text";
}

/** Construye metadatos de columnas a partir de filas con claves arbitrarias. */
export function buildColumnMetaFromRows(
  rows: DataRow[],
  rawHeaders?: string[]
): ColumnMeta[] {
  if (rows.length === 0 && rawHeaders?.length) {
    return rawHeaders.map((h, i) => ({
      id: makeColumnId(i),
      label: normalizeLabel(h, i),
      type: "text" as ColumnDataType,
    }));
  }

  const keys = rawHeaders?.length
    ? rawHeaders.map((_, i) => makeColumnId(i))
    : Object.keys(rows[0] ?? {});

  const labels = rawHeaders?.length
    ? rawHeaders.map((h, i) => normalizeLabel(h, i))
    : keys.map((k, i) => normalizeLabel(k, i));

  return keys.map((id, index) => {
    const values = rows.map((r) => r[id]);
    return {
      id,
      label: labels[index] ?? `Columna ${index + 1}`,
      type: detectColumnType(values),
    };
  });
}

/** Normaliza filas crudas (objeto por encabezado original) a DataRow con ids internos. */
export function normalizeRawRows(
  rawRows: Record<string, unknown>[],
  headers: string[]
): DataRow[] {
  const columnIds = headers.map((_, i) => makeColumnId(i));
  return rawRows.map((raw) => {
    const row: DataRow = {};
    headers.forEach((header, i) => {
      const v = raw[header];
      row[columnIds[i]] =
        v == null ? null : typeof v === "boolean" ? v : typeof v === "number" ? v : String(v);
    });
    return row;
  });
}

export { makeColumnId, normalizeLabel };
