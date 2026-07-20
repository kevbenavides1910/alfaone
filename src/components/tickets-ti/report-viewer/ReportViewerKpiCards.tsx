"use client";

import type { KpiSnapshot } from "@/modules/tickets-ti/report-viewer/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportViewerKpiCards({ kpis, isDark }: { kpis: KpiSnapshot[]; isDark: boolean }) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
      {kpis.map((kpi) => (
        <Card
          key={kpi.id}
          className={isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white shadow-sm"}
        >
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {kpi.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <p className={`text-xl font-bold tabular-nums ${isDark ? "text-slate-100" : "text-slate-900"}`}>
              {typeof kpi.value === "number" ? kpi.value.toLocaleString("es") : kpi.value}
            </p>
            {kpi.hint && <p className="text-[10px] text-slate-400 mt-0.5">{kpi.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
