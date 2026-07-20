"use client";

import Papa from "papaparse";
import type { IDataImporter, ImportProgressCallback, ImportResult } from "./types";

const DELIMITERS = [",", ";", "\t", "|"] as const;
const ENCODINGS = ["utf-8", "windows-1252", "iso-8859-1"] as const;

async function readWithEncoding(buffer: ArrayBuffer, encoding: string): Promise<string> {
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function scoreParseResult(result: Papa.ParseResult<Record<string, unknown>>): number {
  if (result.errors.length > 0) return -1;
  const fields = result.meta.fields?.length ?? 0;
  const rows = result.data.length;
  if (fields === 0 || rows === 0) return 0;
  return fields * 1000 + rows;
}

function parseCsvText(text: string, delimiter: string): Papa.ParseResult<Record<string, unknown>> {
  return Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter,
    quoteChar: '"',
    escapeChar: '"',
    dynamicTyping: false,
  });
}

async function detectBestCsvParse(buffer: ArrayBuffer): Promise<{ text: string; result: Papa.ParseResult<Record<string, unknown>>; warnings: string[] }> {
  const warnings: string[] = [];
  let best: { text: string; result: Papa.ParseResult<Record<string, unknown>>; score: number; encoding: string; delimiter: string } | null = null;

  for (const encoding of ENCODINGS) {
    const text = await readWithEncoding(buffer, encoding);
    for (const delimiter of DELIMITERS) {
      const result = parseCsvText(text, delimiter);
      const score = scoreParseResult(result);
      if (score > (best?.score ?? -1)) {
        best = { text, result, score, encoding, delimiter };
      }
    }
  }

  if (!best || best.score <= 0) {
    const text = await readWithEncoding(buffer, "utf-8");
    const result = parseCsvText(text, ",");
    return { text, result, warnings: ["No se pudo detectar delimitador/codificación de forma óptima; se usó UTF-8 y coma."] };
  }

  warnings.push(`CSV detectado: codificación ${best.encoding}, separador "${best.delimiter === "\t" ? "Tab" : best.delimiter}".`);
  if (best.result.errors.length > 0) {
    warnings.push(`${best.result.errors.length} advertencia(s) de parseo CSV (filas omitidas si eran inválidas).`);
  }

  return { text: best.text, result: best.result, warnings };
}

/** Importador CSV basado en PapaParse. */
export class CsvImporter implements IDataImporter {
  readonly kind = "csv" as const;

  canHandle(file: File): boolean {
    return /\.csv$/i.test(file.name) || file.type === "text/csv";
  }

  async import(file: File, _options?: { sheetName?: string }, onProgress?: ImportProgressCallback): Promise<ImportResult> {
    onProgress?.(5, 0, "Leyendo archivo CSV…");
    const buffer = await file.arrayBuffer();
    onProgress?.(25, 0, "Detectando codificación y separador…");
    const { result, warnings } = await detectBestCsvParse(buffer);

    const headers = (result.meta.fields ?? []).map((h) => String(h));
    const rawRows = result.data.filter((row) => Object.values(row).some((v) => v != null && String(v).trim() !== ""));

    onProgress?.(100, rawRows.length, "CSV procesado");

    if (headers.length === 0) {
      warnings.push("No se detectaron encabezados en el CSV.");
    }
    if (rawRows.length === 0) {
      warnings.push("El CSV no contiene registros.");
    }

    return { rawRows, headers, warnings };
  }
}

export const csvImporter = new CsvImporter();
