export type ImportResult = {
  rawRows: Record<string, unknown>[];
  headers: string[];
  warnings: string[];
  sheetNames?: string[];
};

export type ImportProgressCallback = (percent: number, processedRows: number, message?: string) => void;

/** Contrato para importadores de archivos (CSV, Excel). */
export interface IDataImporter {
  readonly kind: "csv" | "excel";
  canHandle(file: File): boolean;
  listSheets?(file: File): Promise<string[]>;
  import(file: File, options?: { sheetName?: string }, onProgress?: ImportProgressCallback): Promise<ImportResult>;
}
