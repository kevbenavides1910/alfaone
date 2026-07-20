/** Tipos de dato detectados automáticamente en columnas. */
export type ColumnDataType =
  | "text"
  | "number"
  | "decimal"
  | "date"
  | "time"
  | "datetime"
  | "boolean"
  | "currency"
  | "percent";

export type ColumnMeta = {
  id: string;
  label: string;
  type: ColumnDataType;
};

export type DataRow = Record<string, string | number | boolean | null>;

export type ReportDataset = {
  rows: DataRow[];
  columns: ColumnMeta[];
  warnings: string[];
  source: "api" | "file";
  loadedAt: string;
  recordCount: number;
};

export type FilterState = Record<string, FilterValue>;

export type FilterValue =
  | { kind: "text"; value: string }
  | { kind: "multiselect"; values: string[] }
  | { kind: "dateRange"; from: string; to: string }
  | { kind: "numberRange"; min: string; max: string }
  | { kind: "boolean"; value: boolean | null };

export type KpiSnapshot = {
  id: string;
  label: string;
  value: string | number;
  hint?: string;
};

export type ChartSpec = {
  id: string;
  title: string;
  traces: PlotlyTrace[];
  layout?: Record<string, unknown>;
};

/** Subconjunto de Plotly para desacoplar el motor de gráficos. */
export type PlotlyTrace = {
  type: "bar" | "pie" | "scatter" | "heatmap";
  x?: (string | number)[];
  y?: (string | number)[];
  z?: (string | number)[][];
  labels?: string[];
  values?: number[];
  name?: string;
  marker?: { color?: string | string[] };
};

export type LoadProgress = {
  phase: "idle" | "reading" | "parsing" | "processing" | "done" | "error";
  percent: number;
  processedRows: number;
  totalRows: number;
  elapsedMs: number;
  message?: string;
};

export type ViewerTheme = "light" | "dark";
