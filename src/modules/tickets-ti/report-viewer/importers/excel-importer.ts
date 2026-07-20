"use client";

import * as XLSX from "xlsx";
import type { IDataImporter, ImportProgressCallback, ImportResult } from "./types";

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): ImportResult {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Hoja "${sheetName}" no encontrada`);

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
    dateNF: "dd/mm/yyyy",
  });

  const headers =
    json.length > 0
      ? Object.keys(json[0])
      : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" })[0] as string[] | undefined)?.map(String) ?? [];

  const warnings: string[] = [];
  const rawRows = json.filter((row) =>
    Object.values(row).some((v) => v != null && String(v).trim() !== "")
  );

  if (headers.length === 0) warnings.push("No se detectaron encabezados en la hoja Excel.");
  if (rawRows.length === 0) warnings.push("La hoja Excel no contiene registros.");

  return {
    rawRows,
    headers: headers.map(String),
    warnings,
    sheetNames: workbook.SheetNames,
  };
}

/** Importador Excel basado en SheetJS (xlsx). */
export class ExcelImporter implements IDataImporter {
  readonly kind = "excel" as const;

  canHandle(file: File): boolean {
    return /\.(xlsx|xls)$/i.test(file.name) || /spreadsheet|excel/i.test(file.type);
  }

  async listSheets(file: File): Promise<string[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    return workbook.SheetNames;
  }

  async import(
    file: File,
    options?: { sheetName?: string },
    onProgress?: ImportProgressCallback
  ): Promise<ImportResult> {
    onProgress?.(10, 0, "Leyendo archivo Excel…");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true, cellNF: true });
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) throw new Error("El archivo Excel no contiene hojas");

    const sheetName = options?.sheetName ?? sheetNames[0];
    onProgress?.(60, 0, `Procesando hoja "${sheetName}"…`);
    const result = sheetToRows(workbook, sheetName);
    onProgress?.(100, result.rawRows.length, "Excel procesado");
    return { ...result, sheetNames };
  }
}

export const excelImporter = new ExcelImporter();
