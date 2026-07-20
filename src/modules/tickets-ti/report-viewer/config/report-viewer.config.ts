import type { ViewerTheme } from "../types";

/**
 * Configuración del Visualizador de Reportes.
 * Modifique estos valores sin tocar el código del dashboard.
 */
export const REPORT_VIEWER_CONFIG = {
  companyName: "Alfa One",
  logoUrl: "",
  language: "es",
  defaultTheme: "light" as ViewerTheme,
  themeStorageKey: "tickets-ti-report-viewer-theme",
  corporateColors: {
    primary: "#dc2626",
    secondary: "#4f46e5",
    accent: "#0891b2",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
  },
  dateFormat: "dd/MM/yyyy",
  pageSize: 25,
  pageSizeOptions: [10, 25, 50, 100, 250],
  maxRecords: 100_000,
  chunkSize: 2_000,
  chartTopN: 10,
} as const;

export type ReportViewerConfig = typeof REPORT_VIEWER_CONFIG;
