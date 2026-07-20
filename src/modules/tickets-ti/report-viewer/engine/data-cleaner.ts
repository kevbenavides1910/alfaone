import type { ColumnMeta, DataRow } from "../types";
import { buildColumnMetaFromRows, makeColumnId, normalizeLabel } from "./column-detector";

export type CleanResult = {
  rows: DataRow[];
  columns: ColumnMeta[];
  warnings: string[];
};

function isEmptyValue(v: unknown): boolean {
  return v == null || String(v).trim() === "";
}

/** Limpia encabezados, filas/columnas vacías y duplicados; no aborta por advertencias menores. */
export function cleanImportedData(
  rawRows: Record<string, unknown>[],
  rawHeaders: string[]
): CleanResult {
  const warnings: string[] = [];

  const headerCounts = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    const base = normalizeLabel(String(h ?? ""), i);
    const count = (headerCounts.get(base.toLowerCase()) ?? 0) + 1;
    headerCounts.set(base.toLowerCase(), count);
    if (count > 1) {
      warnings.push(`Columna duplicada "${base}" renombrada a "${base} (${count})".`);
      return `${base} (${count})`;
    }
    return base;
  });

  if (headers.length === 0) {
    warnings.push("No se detectaron encabezados; se generaron nombres automáticos.");
  }

  const columnIds = headers.map((_, i) => makeColumnId(i));

  let rows: DataRow[] = rawRows.map((raw) => {
    const row: DataRow = {};
    headers.forEach((header, i) => {
      const originalKey = rawHeaders[i] ?? header;
      const v = raw[header] ?? raw[originalKey];
      row[columnIds[i]] =
        v == null ? null : typeof v === "boolean" ? v : typeof v === "number" ? v : String(v).trim();
    });
    return row;
  });

  const beforeRows = rows.length;
  rows = rows.filter((r) => columnIds.some((id) => !isEmptyValue(r[id])));
  if (beforeRows > rows.length) {
    warnings.push(`Se eliminaron ${beforeRows - rows.length} fila(s) vacía(s).`);
  }

  const nonEmptyColumnIndexes = columnIds
    .map((id, idx) => ({ id, idx }))
    .filter(({ id }) => rows.some((r) => !isEmptyValue(r[id])))
    .map(({ idx }) => idx);

  if (nonEmptyColumnIndexes.length < columnIds.length) {
    const removed = columnIds.length - nonEmptyColumnIndexes.length;
    warnings.push(`Se eliminaron ${removed} columna(s) vacía(s).`);
    const newHeaders = nonEmptyColumnIndexes.map((i) => headers[i]);
    const newIds = newHeaders.map((_, i) => makeColumnId(i));
    rows = rows.map((r) => {
      const next: DataRow = {};
      nonEmptyColumnIndexes.forEach((oldIdx, i) => {
        next[newIds[i]] = r[columnIds[oldIdx]] ?? null;
      });
      return next;
    });
    return {
      rows,
      columns: buildColumnMetaFromRows(rows, newHeaders),
      warnings,
    };
  }

  if (rows.length === 0) {
    warnings.push("No quedaron registros después de la limpieza.");
  }

  return {
    rows,
    columns: buildColumnMetaFromRows(rows, headers),
    warnings,
  };
}
