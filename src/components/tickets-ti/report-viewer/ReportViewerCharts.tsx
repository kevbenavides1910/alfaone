"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ChartSpec } from "@/modules/tickets-ti/report-viewer/types";
import { REPORT_VIEWER_CONFIG } from "@/modules/tickets-ti/report-viewer/config/report-viewer.config";

const Plot = dynamic(() => import("react-plotly.js").then((mod) => mod.default), { ssr: false });

type Props = {
  charts: ChartSpec[];
  isDark: boolean;
};

export function ReportViewerCharts({ charts, isDark }: Props) {
  const layoutBase = useMemo(
    () => ({
      paper_bgcolor: isDark ? "#0f172a" : "#ffffff",
      plot_bgcolor: isDark ? "#1e293b" : "#f8fafc",
      font: { color: isDark ? "#e2e8f0" : "#334155", size: 11 },
      autosize: true,
      height: 320,
    }),
    [isDark]
  );

  if (charts.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        No hay suficientes columnas detectadas para generar gráficos.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {charts.map((chart) => (
        <div
          key={chart.id}
          className={`rounded-xl border p-3 ${isDark ? "border-slate-800 bg-slate-900/40" : "border-slate-200 bg-white"}`}
        >
          <h4 className="text-sm font-semibold mb-2 px-1">{chart.title}</h4>
          <div className="w-full min-h-[320px]">
            <Plot
              data={chart.traces as object[]}
              layout={{ ...layoutBase, ...(chart.layout ?? {}), title: undefined }}
              config={{ displayModeBar: false, responsive: true }}
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
