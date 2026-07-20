"use client";

import type { LoadProgress } from "@/modules/tickets-ti/report-viewer/types";

export function ReportViewerProgress({ progress }: { progress: LoadProgress }) {
  if (progress.phase === "idle" || progress.phase === "done") return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 dark:bg-slate-900/80 p-4 space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{progress.message ?? "Procesando…"}</span>
        <span>{Math.round(progress.percent)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${Math.min(100, progress.percent)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{progress.processedRows.toLocaleString("es")} registros</span>
        <span>{(progress.elapsedMs / 1000).toFixed(1)} s</span>
      </div>
    </div>
  );
}
