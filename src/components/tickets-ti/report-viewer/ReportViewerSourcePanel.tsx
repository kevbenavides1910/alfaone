"use client";

import { useRef, useState } from "react";
import { Calendar, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { toast } from "@/components/ui/toaster";
import { TICKET_EXPORT_STATUS_GROUPS, type TicketExportStatusGroupKey } from "@/modules/tickets-ti/business/report-status-groups";
import { loadHistoryFromApi } from "@/modules/tickets-ti/report-viewer/providers/api-history-provider";
import { importFileToDataset } from "@/modules/tickets-ti/report-viewer/providers/file-data-provider";
import { ImporterFactory } from "@/modules/tickets-ti/report-viewer/importers/importer-factory";
import type { LoadProgress, ReportDataset } from "@/modules/tickets-ti/report-viewer/types";

const GROUP_KEYS = Object.keys(TICKET_EXPORT_STATUS_GROUPS) as TicketExportStatusGroupKey[];

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  onLoaded: (dataset: ReportDataset) => void;
  onProgress: (progress: LoadProgress) => void;
  isDark: boolean;
};

export function ReportViewerSourcePanel({ onLoaded, onProgress, isDark }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth);
  const [dateTo, setDateTo] = useState(todayIso);
  const [statusGroups, setStatusGroups] = useState<TicketExportStatusGroupKey[]>(["ABIERTO", "PROCESO", "CERRADO"]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function startProgress(phase: LoadProgress["phase"]) {
    const start = Date.now();
    return (percent: number, processedRows = 0, message?: string) => {
      onProgress({
        phase,
        percent,
        processedRows,
        totalRows: processedRows,
        elapsedMs: Date.now() - start,
        message,
      });
    };
  }

  async function loadFromHistory() {
    setLoading(true);
    const tick = startProgress("processing");
    try {
      tick(5, 0, "Consultando historial…");
      const dataset = await loadHistoryFromApi(
        {
          dateFrom,
          dateTo,
          filterType: "user",
          statusGroups,
        },
        (p, msg) => tick(p, 0, msg)
      );
      tick(100, dataset.recordCount, "Dashboard listo");
      onProgress({ phase: "done", percent: 100, processedRows: dataset.recordCount, totalRows: dataset.recordCount, elapsedMs: 0 });
      onLoaded(dataset);
      toast.success(`${dataset.recordCount.toLocaleString("es")} registros cargados`);
    } catch (e) {
      onProgress({ phase: "error", percent: 0, processedRows: 0, totalRows: 0, elapsedMs: 0, message: (e as Error).message });
      toast.error(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setPendingFile(file);
    setSelectedSheet("");
    try {
      const sheets = await ImporterFactory.listSheets(file);
      setSheetNames(sheets);
      if (sheets.length === 1) setSelectedSheet(sheets[0]);
    } catch {
      setSheetNames([]);
    }
  }

  async function importFile() {
    const file = pendingFile ?? fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Seleccione un archivo");
      return;
    }
    if (sheetNames.length > 1 && !selectedSheet) {
      toast.error("Seleccione la hoja a importar");
      return;
    }

    setLoading(true);
    const tick = startProgress("parsing");
    try {
      const dataset = await importFileToDataset(
        file,
        selectedSheet || undefined,
        (percent, processedRows, message) => tick(percent, processedRows, message)
      );
      tick(100, dataset.recordCount, "Dashboard listo");
      onProgress({ phase: "done", percent: 100, processedRows: dataset.recordCount, totalRows: dataset.recordCount, elapsedMs: 0 });
      onLoaded(dataset);
      toast.success(`${dataset.recordCount.toLocaleString("es")} registros importados`);
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      onProgress({ phase: "error", percent: 0, processedRows: 0, totalRows: 0, elapsedMs: 0, message: (e as Error).message });
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setLoading(false);
    }
  }

  const panel = isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border p-4 space-y-6 ${panel}`}>
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-600" />
          Opción 1 · Rango de fechas (Historial de Tickets)
        </h3>
        <p className="text-xs text-slate-500 mt-1">Consulta directa a la plataforma, sin archivos temporales.</p>
        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <div className="space-y-1.5">
            <Label>Desde</Label>
            <CalendarDateInput value={dateFrom} onChange={setDateFrom} showPicker />
          </div>
          <div className="space-y-1.5">
            <Label>Hasta</Label>
            <CalendarDateInput value={dateTo} onChange={setDateTo} showPicker />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {GROUP_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={statusGroups.includes(key)}
                onChange={() =>
                  setStatusGroups((prev) =>
                    prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]
                  )
                }
              />
              {TICKET_EXPORT_STATUS_GROUPS[key].label}
            </label>
          ))}
        </div>
        <Button className="mt-3 gap-2" disabled={loading} onClick={loadFromHistory}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
          Cargar al dashboard
        </Button>
      </div>

      <div className="border-t border-inherit pt-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-indigo-600" />
          Opción 2 · Importar datos
        </h3>
        <p className="text-xs text-slate-500 mt-1">CSV (.csv) o Excel (.xlsx, .xls). Detección automática de formato.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="mt-3 block w-full text-xs"
          onChange={(e) => void onFileSelected(e.target.files?.[0] ?? null)}
        />
        {sheetNames.length > 1 && (
          <div className="mt-3 space-y-1.5">
            <Label>Hoja de Excel</Label>
            <select
              className="w-full rounded-md border px-2 py-2 text-sm bg-transparent"
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
            >
              <option value="">Seleccione hoja…</option>
              {sheetNames.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        <Button variant="secondary" className="mt-3 gap-2" disabled={loading} onClick={importFile}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Importar datos
        </Button>
      </div>
    </div>
  );
}
