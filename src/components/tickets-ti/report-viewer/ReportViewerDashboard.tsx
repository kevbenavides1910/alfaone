"use client";

import { useMemo, useState } from "react";
import type { FilterState, ReportDataset } from "@/modules/tickets-ti/report-viewer/types";
import { filterRows } from "@/modules/tickets-ti/report-viewer/engine/filter-engine";
import { computeKpis } from "@/modules/tickets-ti/report-viewer/engine/kpi-calculator";
import { buildCharts } from "@/modules/tickets-ti/report-viewer/engine/chart-builder";
import { REPORT_VIEWER_CONFIG } from "@/modules/tickets-ti/report-viewer/config/report-viewer.config";
import { ReportViewerKpiCards } from "./ReportViewerKpiCards";
import { ReportViewerFilters } from "./ReportViewerFilters";
import { ReportViewerCharts } from "./ReportViewerCharts";
import { ReportViewerDataTable } from "./ReportViewerDataTable";
import { viewerThemeClass } from "./use-report-viewer-theme";

type Props = {
  dataset: ReportDataset;
  isDark: boolean;
};

export function ReportViewerDashboard({ dataset, isDark }: Props) {
  const [filters, setFilters] = useState<FilterState>({});

  const filteredRows = useMemo(() => filterRows(dataset.rows, filters), [dataset.rows, filters]);
  const kpis = useMemo(() => computeKpis(filteredRows, dataset.columns), [filteredRows, dataset.columns]);
  const charts = useMemo(() => buildCharts(filteredRows, dataset.columns), [filteredRows, dataset.columns]);

  return (
    <div className={`space-y-6 rounded-2xl p-4 md:p-6 ${viewerThemeClass(isDark)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{REPORT_VIEWER_CONFIG.companyName} · Dashboard</h2>
          <p className="text-xs opacity-70">
            {filteredRows.length.toLocaleString("es")} registros · Fuente:{" "}
            {dataset.source === "api" ? "Historial de Tickets" : "Archivo importado"} ·{" "}
            {new Date(dataset.loadedAt).toLocaleString("es")}
          </p>
        </div>
      </div>

      {dataset.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
          {dataset.warnings.map((w, i) => (
            <p key={i}>⚠ {w}</p>
          ))}
        </div>
      )}

      <ReportViewerKpiCards kpis={kpis} isDark={isDark} />
      <ReportViewerFilters
        columns={dataset.columns}
        rows={dataset.rows}
        filters={filters}
        onChange={setFilters}
        isDark={isDark}
      />
      <ReportViewerCharts charts={charts} isDark={isDark} />
      <ReportViewerDataTable rows={filteredRows} columns={dataset.columns} isDark={isDark} />
    </div>
  );
}
