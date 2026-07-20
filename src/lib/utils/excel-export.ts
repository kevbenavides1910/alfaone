/**
 * Helper reutilizable para exportar tablas a Excel desde el cliente.
 *
 * Uso:
 *   exportRowsToExcel({
 *     filename: "inventario_stock",
 *     sheetName: "Stock",
 *     rows: assets.map(a => ({
 *       Código: a.code,
 *       Tipo: a.type.name,
 *       ...
 *     })),
 *     columnWidths: [10, 18, 30],
 *     totalRow: { Código: "TOTAL", Monto: total },
 *   });
 */
import * as XLSX from "xlsx";

/** Evita formula injection al abrir el Excel en desktop. */
export function sanitizeExportCell(
  value: string | number | null | undefined,
): string | number | null | undefined {
  if (value == null) return value;
  if (typeof value === "number") return value;
  const s = String(value);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

function sanitizeRows(
  rows: Array<Record<string, string | number | null | undefined>>,
): Array<Record<string, string | number | null | undefined>> {
  return rows.map((row) => {
    const out: Record<string, string | number | null | undefined> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = sanitizeExportCell(v);
    }
    return out;
  });
}

export interface ExportRowsOptions {
  /** Nombre del archivo sin extensión. Se le agrega `_YYYY-MM-DD.xlsx` automáticamente. */
  filename: string;
  /** Nombre de la hoja dentro del libro. Por defecto "Datos". */
  sheetName?: string;
  /** Filas a exportar (cada llave del objeto es una columna). */
  rows: Array<Record<string, string | number | null | undefined>>;
  /**
   * Anchos en caracteres por columna, en el orden en que aparecen en la primera fila.
   * Si no se provee, Excel usa anchos por defecto.
   */
  columnWidths?: number[];
  /**
   * Una fila opcional al final (típicamente para totales). Las llaves deben coincidir
   * con las de `rows` para que Excel las alinee con las columnas correctas.
   */
  totalRow?: Record<string, string | number | null | undefined>;
  /** Si es false no se agrega la fecha al nombre del archivo. Por defecto true. */
  appendDateToFilename?: boolean;
}

export interface ExportSheet {
  sheetName: string;
  rows: Array<Record<string, string | number | null | undefined>>;
  columnWidths?: number[];
  totalRow?: Record<string, string | number | null | undefined>;
}

export interface ExportWorkbookOptions {
  filename: string;
  sheets: ExportSheet[];
  appendDateToFilename?: boolean;
}

function buildWorksheet(
  rows: Array<Record<string, string | number | null | undefined>>,
  columnWidths?: number[],
  totalRow?: Record<string, string | number | null | undefined>,
) {
  const sanitized = sanitizeRows(rows);
  const sanitizedTotal = totalRow
    ? Object.fromEntries(
        Object.entries(totalRow).map(([k, v]) => [k, sanitizeExportCell(v)]),
      )
    : undefined;
  const data = sanitizedTotal ? [...sanitized, sanitizedTotal] : sanitized;
  const ws = XLSX.utils.json_to_sheet(data);
  if (columnWidths && columnWidths.length > 0) {
    ws["!cols"] = columnWidths.map((wch) => ({ wch }));
  }
  return ws;
}

export function exportWorkbookToExcel(opts: ExportWorkbookOptions): void {
  const { filename, sheets, appendDateToFilename = true } = opts;
  const nonEmptySheets = sheets.filter((sheet) => sheet.rows.length > 0 || sheet.totalRow);
  if (nonEmptySheets.length === 0) return;

  const wb = XLSX.utils.book_new();
  for (const sheet of nonEmptySheets) {
    const ws = buildWorksheet(sheet.rows, sheet.columnWidths, sheet.totalRow);
    const safeSheetName = sheet.sheetName.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Datos";
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  }

  const safeFilename = filename.replace(/[\\/?*"<>|]/g, "_");
  const stamp = appendDateToFilename ? `_${new Date().toISOString().slice(0, 10)}` : "";
  XLSX.writeFile(wb, `${safeFilename}${stamp}.xlsx`);
}

/**
 * Genera y descarga un archivo Excel desde un arreglo de filas.
 * Solo funciona en el cliente (browser); no llamar desde el server.
 */
export function exportRowsToExcel(opts: ExportRowsOptions): void {
  const {
    filename,
    sheetName = "Datos",
    rows,
    columnWidths,
    totalRow,
    appendDateToFilename = true,
  } = opts;

  if (rows.length === 0 && !totalRow) {
    return;
  }

  const ws = buildWorksheet(rows, columnWidths, totalRow);

  const wb = XLSX.utils.book_new();
  // Excel limita los nombres de hojas a 31 caracteres y prohíbe ciertos caracteres.
  const safeSheetName = sheetName.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Datos";
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const safeFilename = filename.replace(/[\\/?*"<>|]/g, "_");
  const stamp = appendDateToFilename ? `_${new Date().toISOString().slice(0, 10)}` : "";
  XLSX.writeFile(wb, `${safeFilename}${stamp}.xlsx`);
}
