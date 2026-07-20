import type { ChartSpec, ColumnMeta, DataRow } from "../types";
import { REPORT_VIEWER_CONFIG } from "../config/report-viewer.config";
import { findColumnByPattern } from "./filter-engine";
import { PATTERNS } from "./kpi-calculator";

function aggregateCount(rows: DataRow[], columnId: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row[columnId] ?? "Sin dato").trim() || "Sin dato";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function topN(map: Map<string, number>, n: number): { labels: string[]; values: number[] } {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return {
    labels: sorted.map(([k]) => k),
    values: sorted.map(([, v]) => v),
  };
}

function barChart(id: string, title: string, labels: string[], values: number[]): ChartSpec {
  return {
    id,
    title,
    traces: [{ type: "bar", x: labels, y: values, marker: { color: REPORT_VIEWER_CONFIG.corporateColors.secondary } }],
    layout: { margin: { t: 40, b: 80 }, xaxis: { tickangle: -35 } },
  };
}

function pieChart(id: string, title: string, labels: string[], values: number[]): ChartSpec {
  return {
    id,
    title,
    traces: [{ type: "pie", labels, values }],
    layout: { margin: { t: 40 } },
  };
}

function trendByDate(rows: DataRow[], dateCol: string): ChartSpec | null {
  const map = new Map<string, number>();
  for (const row of rows) {
    const raw = String(row[dateCol] ?? "");
    const t = Date.parse(raw);
    if (Number.isNaN(t)) continue;
    const d = new Date(t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  if (map.size === 0) return null;
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    id: "trendDate",
    title: "Tendencia por Fecha",
    traces: [
      {
        type: "scatter",
        x: sorted.map(([k]) => k),
        y: sorted.map(([, v]) => v),
        name: "Incidentes",
        marker: { color: REPORT_VIEWER_CONFIG.corporateColors.primary },
      },
    ],
    layout: { margin: { t: 40, b: 60 } },
  };
}

function heatmapCategorySeverity(
  rows: DataRow[],
  categoryCol: string,
  severityCol: string
): ChartSpec | null {
  const categories = [...new Set(rows.map((r) => String(r[categoryCol] ?? "Sin dato")))].slice(0, 15);
  const severities = [...new Set(rows.map((r) => String(r[severityCol] ?? "Sin dato")))].slice(0, 10);
  if (categories.length === 0 || severities.length === 0) return null;

  const z: number[][] = categories.map((cat) =>
    severities.map((sev) =>
      rows.filter(
        (r) => String(r[categoryCol] ?? "Sin dato") === cat && String(r[severityCol] ?? "Sin dato") === sev
      ).length
    )
  );

  return {
    id: "heatmap",
    title: "HeatMap Categoría vs Severidad",
    traces: [{ type: "heatmap", x: severities, y: categories, z }],
    layout: { margin: { t: 40, l: 120 } },
  };
}

/** Construye gráficos Plotly dinámicamente según columnas disponibles. */
export function buildCharts(rows: DataRow[], columns: ColumnMeta[]): ChartSpec[] {
  const charts: ChartSpec[] = [];
  const topLimit = REPORT_VIEWER_CONFIG.chartTopN;

  const statusCol = findColumnByPattern(columns, PATTERNS.status);
  if (statusCol) {
    const { labels, values } = topN(aggregateCount(rows, statusCol.id), 20);
    charts.push(pieChart("byStatus", "Incidentes por Estado", labels, values));
  }

  const clientCol = findColumnByPattern(columns, PATTERNS.client);
  if (clientCol) {
    const { labels, values } = topN(aggregateCount(rows, clientCol.id), topLimit);
    charts.push(barChart("byClient", "Incidentes por Cliente", labels, values));
    charts.push(barChart("topClients", `Top ${topLimit} Clientes`, labels, values));
  }

  const productCol = findColumnByPattern(columns, PATTERNS.product);
  if (productCol) {
    const { labels, values } = topN(aggregateCount(rows, productCol.id), topLimit);
    charts.push(barChart("byProduct", "Incidentes por Producto", labels, values));
  }

  const categoryCol = findColumnByPattern(columns, PATTERNS.category);
  if (categoryCol) {
    const { labels, values } = topN(aggregateCount(rows, categoryCol.id), topLimit);
    charts.push(barChart("byCategory", "Incidentes por Categoría", labels, values));
  }

  const severityCol = findColumnByPattern(columns, PATTERNS.severity);
  if (severityCol) {
    const { labels, values } = topN(aggregateCount(rows, severityCol.id), topLimit);
    charts.push(barChart("bySeverity", "Incidentes por Severidad", labels, values));
  }

  const urgencyCol = findColumnByPattern(columns, PATTERNS.urgency);
  if (urgencyCol) {
    const { labels, values } = topN(aggregateCount(rows, urgencyCol.id), topLimit);
    charts.push(barChart("byUrgency", "Incidentes por Urgencia", labels, values));
  }

  const techCol = findColumnByPattern(columns, PATTERNS.technician);
  if (techCol) {
    const { labels, values } = topN(aggregateCount(rows, techCol.id), topLimit);
    charts.push(barChart("topTechnicians", `Top ${topLimit} Técnicos`, labels, values));
  }

  const dateCol = findColumnByPattern(columns, PATTERNS.opened);
  if (dateCol) {
    const trend = trendByDate(rows, dateCol.id);
    if (trend) charts.push(trend);
  }

  if (categoryCol && severityCol) {
    const heat = heatmapCategorySeverity(rows, categoryCol.id, severityCol.id);
    if (heat) charts.push(heat);
  }

  return charts;
}
