import { readFile } from "fs/promises";
import * as XLSX from "xlsx";
import { MonthlyReportError, getMonthlyReportFile, readMonthlyReportTemplate } from "./reports";

export type IncidentDetailSummary = {
  sheetName: string;
  columns: string[];
  rows: string[][];
};

export type IncidentSummaryDto = {
  source: {
    kind: "base" | "upload";
    fileName: string;
    period: string | null;
  };
  detail: IncidentDetailSummary | null;
};

type SheetMatrix = unknown[][];

const normalize = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

function sheetMatrix(workbook: XLSX.WorkBook, sheetName: string): SheetMatrix | null {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as SheetMatrix;
}

function findSheetName(workbook: XLSX.WorkBook, needle: string): string | null {
  const target = needle.toLowerCase();
  return workbook.SheetNames.find((name) => name.toLowerCase().includes(target)) ?? null;
}

function parseDetail(workbook: XLSX.WorkBook): IncidentDetailSummary | null {
  const sheetName = findSheetName(workbook, "informe del monte");
  if (!sheetName) return null;
  const matrix = sheetMatrix(workbook, sheetName);
  if (!matrix || matrix.length === 0) return null;

  const headerRow = matrix[0].map(normalize);
  let lastColumn = headerRow.length - 1;
  while (lastColumn >= 0 && !headerRow[lastColumn]) lastColumn -= 1;
  if (lastColumn < 0) return null;

  const columns = headerRow.slice(0, lastColumn + 1);
  const rows: string[][] = [];

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];
    const values = columns.map((_, column) => normalize(row[column]));
    if (values.every((value) => !value)) continue;
    // Las filas de fórmulas arrastradas no tienen número de incidente.
    if (!values[0]) continue;
    rows.push(values);
    if (rows.length >= 500) break;
  }

  return { sheetName, columns: columns.map((column, index) => column || `Columna ${index + 1}`), rows };
}

export async function buildIncidentSummary(input: { reportId?: string }): Promise<IncidentSummaryDto> {
  let buffer: Buffer;
  let source: IncidentSummaryDto["source"];

  if (input.reportId) {
    const { row, abs } = await getMonthlyReportFile(input.reportId);
    buffer = await readFile(abs);
    source = { kind: "upload", fileName: row.fileName, period: row.period };
  } else {
    buffer = await readMonthlyReportTemplate();
    source = { kind: "base", fileName: "INFORME_DEL_MONTE_base.xlsx", period: null };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    throw new MonthlyReportError("No se pudo leer el archivo Excel");
  }

  return {
    source,
    detail: parseDetail(workbook),
  };
}
