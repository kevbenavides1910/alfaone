"use client";

import type { IDataImporter } from "./types";
import { csvImporter } from "./csv-importer";
import { excelImporter } from "./excel-importer";

const IMPORTERS: IDataImporter[] = [csvImporter, excelImporter];

/** Factory que selecciona el importador según tipo de archivo. */
export class ImporterFactory {
  static resolve(file: File): IDataImporter {
    const importer = IMPORTERS.find((i) => i.canHandle(file));
    if (!importer) {
      throw new Error("Formato no soportado. Use CSV (.csv) o Excel (.xlsx, .xls).");
    }
    return importer;
  }

  static async listSheets(file: File): Promise<string[]> {
    const importer = ImporterFactory.resolve(file);
    if (!importer.listSheets) return [];
    return importer.listSheets(file);
  }
}

export { csvImporter, excelImporter };
