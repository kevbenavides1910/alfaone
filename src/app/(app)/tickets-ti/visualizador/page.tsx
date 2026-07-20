"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LoadProgress, ReportDataset } from "@/modules/tickets-ti/report-viewer/types";
import { ReportViewerSourcePanel } from "@/components/tickets-ti/report-viewer/ReportViewerSourcePanel";
import { ReportViewerDashboard } from "@/components/tickets-ti/report-viewer/ReportViewerDashboard";
import { ReportViewerProgress } from "@/components/tickets-ti/report-viewer/ReportViewerProgress";
import { useReportViewerTheme, viewerThemeClass } from "@/components/tickets-ti/report-viewer/use-report-viewer-theme";

export default function ReportViewerPage() {
  const { isDark, toggleTheme } = useReportViewerTheme();
  const [dataset, setDataset] = useState<ReportDataset | null>(null);
  const [progress, setProgress] = useState<LoadProgress>({
    phase: "idle",
    percent: 0,
    processedRows: 0,
    totalRows: 0,
    elapsedMs: 0,
  });

  return (
    <div className={`min-h-screen p-4 md:p-6 space-y-6 ${viewerThemeClass(isDark)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2">
            <Link href="/tickets-ti">
              <ArrowLeft className="h-4 w-4" />
              Centro de Operaciones
            </Link>
          </Button>
          <h1 className="text-xl font-bold">Visualizador de Reportes</h1>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={toggleTheme}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "Modo claro" : "Modo oscuro"}
        </Button>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        <ReportViewerProgress progress={progress} />
        {!dataset && (
          <ReportViewerSourcePanel onLoaded={setDataset} onProgress={setProgress} isDark={isDark} />
        )}
        {dataset && (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDataset(null)}>
                Cambiar fuente de datos
              </Button>
            </div>
            <ReportViewerDashboard dataset={dataset} isDark={isDark} />
          </>
        )}
      </div>
    </div>
  );
}
