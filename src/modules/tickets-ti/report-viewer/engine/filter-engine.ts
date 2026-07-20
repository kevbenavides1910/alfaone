import type { ColumnMeta, DataRow, FilterState, FilterValue } from "../types";

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function matchesText(value: unknown, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  if (!f) return true;
  return cellText(value).toLowerCase().includes(f);
}

function matchesMultiselect(value: unknown, values: string[]): boolean {
  if (values.length === 0) return true;
  return values.includes(cellText(value));
}

function parseDateValue(value: unknown): number | null {
  const s = cellText(value);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function matchesDateRange(value: unknown, from: string, to: string): boolean {
  if (!from && !to) return true;
  const t = parseDateValue(value);
  if (t == null) return false;
  if (from && t < Date.parse(from)) return false;
  if (to && t > Date.parse(to + "T23:59:59")) return false;
  return true;
}

function parseNumber(value: unknown): number | null {
  const s = cellText(value).replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function matchesNumberRange(value: unknown, min: string, max: string): boolean {
  const n = parseNumber(value);
  if (n == null) return !min && !max;
  if (min && n < Number(min)) return false;
  if (max && n > Number(max)) return false;
  return true;
}

function matchesBoolean(value: unknown, expected: boolean | null): boolean {
  if (expected == null) return true;
  const s = cellText(value).toLowerCase();
  const truthy = ["true", "1", "sí", "si", "yes"];
  const falsy = ["false", "0", "no"];
  if (expected) return truthy.includes(s) || value === true;
  return falsy.includes(s) || value === false;
}

function applyFilter(row: DataRow, columnId: string, filter: FilterValue): boolean {
  const value = row[columnId];
  switch (filter.kind) {
    case "text":
      return matchesText(value, filter.value);
    case "multiselect":
      return matchesMultiselect(value, filter.values);
    case "dateRange":
      return matchesDateRange(value, filter.from, filter.to);
    case "numberRange":
      return matchesNumberRange(value, filter.min, filter.max);
    case "boolean":
      return matchesBoolean(value, filter.value);
    default:
      return true;
  }
}

/** Aplica todos los filtros simultáneamente (AND). */
export function filterRows(rows: DataRow[], filters: FilterState): DataRow[] {
  const active = Object.entries(filters).filter(([, f]) => {
    if (f.kind === "text") return f.value.trim() !== "";
    if (f.kind === "multiselect") return f.values.length > 0;
    if (f.kind === "dateRange") return f.from || f.to;
    if (f.kind === "numberRange") return f.min || f.max;
    if (f.kind === "boolean") return f.value != null;
    return false;
  });
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every(([colId, f]) => applyFilter(row, colId, f)));
}

export function uniqueColumnValues(rows: DataRow[], columnId: string, limit = 500): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = cellText(row[columnId]);
    if (v) set.add(v);
    if (set.size >= limit) break;
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function findColumnByPattern(columns: ColumnMeta[], pattern: RegExp): ColumnMeta | undefined {
  return columns.find((c) => pattern.test(c.label));
}
