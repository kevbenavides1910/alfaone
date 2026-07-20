/** Máximo de valores distintos para mostrar lista desplegable en lugar de búsqueda. */
export const COLUMN_FILTER_SELECT_MAX = 6;

/** Separador interno para varios valores en un filtro de columna (modo select). */
export const COLUMN_FILTER_MULTI_SEP = "\x1e";

export function normalizeColumnFilterText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function parseColumnMultiFilter(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.includes(COLUMN_FILTER_MULTI_SEP)) {
    return trimmed.split(COLUMN_FILTER_MULTI_SEP).map((s) => s.trim()).filter(Boolean);
  }
  return [trimmed];
}

export function serializeColumnMultiFilter(values: string[]): string {
  return values.map((v) => v.trim()).filter(Boolean).join(COLUMN_FILTER_MULTI_SEP);
}

export function matchesColumnTextFilter(cellValue: unknown, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  if (!f) return true;
  return normalizeColumnFilterText(cellValue).toLowerCase().includes(f);
}

export function matchesColumnExactFilter(cellValue: unknown, filter: string): boolean {
  const f = filter.trim();
  if (!f) return true;
  return normalizeColumnFilterText(cellValue).toLowerCase() === f.toLowerCase();
}

/** Filtro select: admite uno o varios valores (OR). */
export function matchesColumnSelectFilter(cellValue: unknown, filter: string): boolean {
  const selected = parseColumnMultiFilter(filter);
  if (selected.length === 0) return true;
  const cell = normalizeColumnFilterText(cellValue).toLowerCase();
  return selected.some((s) => cell === s.toLowerCase());
}

export function collectDistinctColumnValues<T>(
  rows: T[],
  getValue: (row: T) => unknown,
  format?: (value: unknown, row: T) => string
): string[] {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const raw = getValue(row);
    const label = format ? format(raw, row) : normalizeColumnFilterText(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, label);
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "es"));
}

export function shouldUseColumnSelectOptionCount(count: number, max = COLUMN_FILTER_SELECT_MAX): boolean {
  return count > 0 && count <= max;
}

export type ColumnFilterOption = { value: string; label: string };

export function optionsFromDistinctValues(values: string[]): ColumnFilterOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

export function resolveColumnFilterOptions<T>(
  rows: T[],
  getValue: (row: T) => unknown,
  staticOptions?: ColumnFilterOption[],
  format?: (value: unknown, row: T) => string
): { options: ColumnFilterOption[]; mode: "select" | "search" } {
  if (staticOptions && staticOptions.length > 0) {
    return {
      options: staticOptions,
      mode: staticOptions.length <= COLUMN_FILTER_SELECT_MAX ? "select" : "search",
    };
  }
  const distinct = collectDistinctColumnValues(rows, getValue, format);
  return {
    options: optionsFromDistinctValues(distinct),
    mode: shouldUseColumnSelectOptionCount(distinct.length) ? "select" : "search",
  };
}

export function filterRowsByColumnFilters<T>(
  rows: T[],
  filters: Record<string, string>,
  columns: Array<{
    key: string;
    getValue: (row: T) => unknown;
    mode?: "select" | "search";
    filterable?: boolean;
    options?: ColumnFilterOption[];
    formatValue?: (value: unknown, row: T) => string;
  }>
): T[] {
  const active = columns.filter((c) => c.filterable !== false);
  return rows.filter((row) =>
    active.every((col) => {
      const raw = filters[col.key] ?? "";
      if (!raw.trim()) return true;
      const cell = col.getValue(row);
      const mode =
        col.mode ??
        resolveColumnFilterOptions(rows, col.getValue, col.options, col.formatValue).mode;
      return mode === "select"
        ? matchesColumnSelectFilter(cell, raw)
        : matchesColumnTextFilter(cell, raw);
    })
  );
}
