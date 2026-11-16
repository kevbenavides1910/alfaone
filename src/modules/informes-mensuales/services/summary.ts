import { readFile } from "fs/promises";
import * as XLSX from "xlsx";
import { MonthlyReportError, getMonthlyReportFile, readMonthlyReportTemplate } from "./reports";

export type AnnualIncidentRow = {
  label: string;
  values: number[];
  total: number;
};

export type AnnualIncidentSummary = {
  title: string;
  year: string;
  engineer: string;
  months: string[];
  rows: AnnualIncidentRow[];
  totals: { values: number[]; total: number };
};

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
  annual: AnnualIncidentSummary | null;
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

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAnnual(workbook: XLSX.WorkBook): AnnualIncidentSummary | null {
  const sheetName = findSheetName(workbook, "informe anual");
  if (!sheetName) return null;
  const matrix = sheetMatrix(workbook, sheetName);
  if (!matrix || matrix.length === 0) return null;

  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => normalize(cell).toLowerCase() === "tipo de evento"),
  );
  if (headerIndex < 0) return null;

  const header = matrix[headerIndex].map(normalize);
  const labelIndex = header.findIndex((cell) => cell.toLowerCase() === "tipo de evento");
  if (labelIndex < 0) return null;

  const months: string[] = [];
  const monthIndexes: number[] = [];
  for (let column = labelIndex + 1; column < header.length; column += 1) {
    const value = header[column];
    if (!value) continue;
    if (/total|acum/i.test(value)) continue;
    months.push(value);
    monthIndexes.push(column);
  }
  if (months.length === 0) return null;

  const rows: AnnualIncidentRow[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const label = normalize(matrix[rowIndex][labelIndex]);
    if (!label) {
      if (rows.length > 0) break;
      continue;
    }
    if (/^total/i.test(label)) break;

    const values = monthIndexes.map((column) => toNumber(matrix[rowIndex][column]));
    rows.push({
      label,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    });
    if (rows.length >= 60) break;
  }

  if (rows.length === 0) return null;

  const totalsValues = months.map((_, index) =>
    rows.reduce((sum, row) => sum + (row.values[index] ?? 0), 0),
  );

  const preamble = matrix
    .slice(0, headerIndex)
    .flat()
    .map(normalize)
    .filter(Boolean);
  const yearText = preamble.find((value) => /año/i.test(value)) ?? "";
  const year = yearText.match(/\d{4}/)?.[0] ?? preamble.find((value) => /^\d{4}$/.test(value)) ?? "";
  const engineer = preamble.find((value) => /ingeniero/i.test(value)) ?? "";
  const title = preamble.find((value) => /reporte|informe/i.test(value)) ?? "Reporte de incidentes";

  return {
    title,
    year,
    engineer,
    months,
    rows,
    totals: {
      values: totalsValues,
      total: totalsValues.reduce((sum, value) => sum + value, 0),
    },
  };
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
    annual: parseAnnual(workbook),
    detail: parseDetail(workbook),
  };
}
