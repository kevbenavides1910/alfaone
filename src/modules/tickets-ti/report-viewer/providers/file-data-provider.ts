"use client";

import { cleanImportedData } from "../engine/data-cleaner";
import { ImporterFactory } from "../importers/importer-factory";
import type { ImportProgressCallback } from "../importers/types";
import type { ReportDataset } from "../types";
import { REPORT_VIEWER_CONFIG } from "../config/report-viewer.config";

/** Proveedor de datos desde archivo importado (CSV/Excel). */
export class FileDataProvider {
  constructor(
    private readonly file: File,
    private readonly sheetName?: string
  ) {}

  async load(onProgress?: ImportProgressCallback): Promise<ReportDataset> {
    const importer = ImporterFactory.resolve(this.file);
    const imported = await importer.import(this.file, { sheetName: this.sheetName }, onProgress);

    if (imported.rawRows.length > REPORT_VIEWER_CONFIG.maxRecords) {
      imported.warnings.push(
        `Se truncaron registros a ${REPORT_VIEWER_CONFIG.maxRecords.toLocaleString("es")} (máximo configurado).`
      );
      imported.rawRows = imported.rawRows.slice(0, REPORT_VIEWER_CONFIG.maxRecords);
    }

    const cleaned = cleanImportedData(imported.rawRows, imported.headers);

    return {
      rows: cleaned.rows,
      columns: cleaned.columns,
      warnings: [...imported.warnings, ...cleaned.warnings],
      source: "file",
      loadedAt: new Date().toISOString(),
      recordCount: cleaned.rows.length,
    };
  }
}

export async function importFileToDataset(
  file: File,
  sheetName?: string,
  onProgress?: ImportProgressCallback
): Promise<ReportDataset> {
  return new FileDataProvider(file, sheetName).load(onProgress);
}
