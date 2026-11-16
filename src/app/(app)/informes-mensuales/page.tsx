"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils/format";

type MonthlyReport = {
  id: string;
  period: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
  downloadUrl: string;
};

type IncidentDetailSummary = {
  sheetName: string;
  columns: string[];
  rows: string[][];
};

type IncidentSummary = {
  source: { kind: "base" | "upload"; fileName: string; period: string | null };
  detail: IncidentDetailSummary | null;
};

type MonthlyIncident = {
  id: string;
  source: string;
  data: Record<string, string>;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

type DisplayRow = {
  values: string[];
  manualId?: string;
};

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const periodLabel = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  const label = new Date(year, (month || 1) - 1, 1).toLocaleDateString("es-CR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

async function readError(response: Response) {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ?? "Error inesperado";
  } catch {
    return "Error inesperado";
  }
}

export default function InformesMensualesPage() {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [period, setPeriod] = useState(currentPeriod);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [yearFilter, setYearFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summarySource, setSummarySource] = useState("base");
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<MonthlyIncident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [incidentForm, setIncidentForm] = useState<Record<string, string>>({});
  const [incidentSaving, setIncidentSaving] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [deletingIncidentId, setDeletingIncidentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/informes-mensuales", { credentials: "same-origin" });
      if (!response.ok) throw new Error(await readError(response));
      const json = (await response.json()) as { data?: MonthlyReport[] };
      setReports(json.data ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los informes");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (source: string) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const query = source === "base" ? "" : `?reportId=${encodeURIComponent(source)}`;
      const response = await fetch(`/api/informes-mensuales/resumen${query}`, {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await readError(response));
      const json = (await response.json()) as { data?: IncidentSummary };
      setSummary(json.data ?? null);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "No se pudo leer el resumen de incidencias");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadIncidents = useCallback(async (source: string) => {
    setIncidentsLoading(true);
    try {
      const response = await fetch(
        `/api/informes-mensuales/incidencias?source=${encodeURIComponent(source)}`,
        { credentials: "same-origin" },
      );
      if (!response.ok) throw new Error(await readError(response));
      const json = (await response.json()) as { data?: MonthlyIncident[] };
      setIncidents(json.data ?? []);
      setIncidentsError(null);
    } catch (err) {
      setIncidentsError(
        err instanceof Error ? err.message : "No se pudieron cargar las incidencias",
      );
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary(summarySource);
    void loadIncidents(summarySource);
    setFilters({});
  }, [loadSummary, loadIncidents, summarySource]);

  const years = useMemo(
    () => Array.from(new Set(reports.map((report) => report.period.slice(0, 4)))).sort().reverse(),
    [reports],
  );

  const grouped = useMemo(() => {
    const visible =
      yearFilter === "all"
        ? reports
        : reports.filter((report) => report.period.startsWith(yearFilter));
    const map = new Map<string, MonthlyReport[]>();
    for (const report of visible) {
      const list = map.get(report.period) ?? [];
      list.push(report);
      map.set(report.period, list);
    }
    return Array.from(map.entries());
  }, [reports, yearFilter]);

  const detailColumns = useMemo(() => summary?.detail?.columns ?? [], [summary]);

  const detailRows = useMemo<DisplayRow[]>(() => {
    if (!summary?.detail) return [];
    const excelRows: DisplayRow[] = summary.detail.rows.map((values) => ({ values }));
    const manualRows: DisplayRow[] = incidents.map((incident) => ({
      values: summary.detail!.columns.map((column) => incident.data[column] ?? ""),
      manualId: incident.id,
    }));
    return [...excelRows, ...manualRows];
  }, [summary, incidents]);

  const filterOptions = useMemo(
    () =>
      detailColumns.map((_, index) => {
        const values = Array.from(
          new Set(detailRows.map((row) => row.values[index]).filter(Boolean)),
        );
        return values.length > 0 && values.length <= 25
          ? values.sort((a, b) => a.localeCompare(b, "es"))
          : null;
      }),
    [detailColumns, detailRows],
  );

  const filtersActive = Object.values(filters).some((value) => value.trim().length > 0);

  const filteredRows = useMemo(() => {
    if (!filtersActive) return detailRows;
    return detailRows.filter((row) =>
      detailColumns.every((column, index) => {
        const filter = filters[column]?.trim().toLowerCase();
        if (!filter) return true;
        return (row.values[index] ?? "").toLowerCase().includes(filter);
      }),
    );
  }, [detailRows, detailColumns, filters, filtersActive]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("Seleccioná un archivo antes de subir.");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const form = new FormData();
      form.set("period", period);
      form.set("note", note);
      form.set("file", file);

      const response = await fetch("/api/informes-mensuales", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await readError(response));
      const json = (await response.json()) as { data?: MonthlyReport };

      setMessage("Informe cargado correctamente.");
      setFile(null);
      setNote("");
      setFileInputKey((key) => key + 1);
      if (json.data?.id) setSummarySource(json.data.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el informe");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("¿Eliminar este informe? Esta acción no se puede deshacer.")) return;

    setDeletingId(id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/informes-mensuales/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await readError(response));
      setMessage("Informe eliminado.");
      if (summarySource === id) setSummarySource("base");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el informe");
    } finally {
      setDeletingId(null);
    }
  };

  const nextIncidentNumber = () => {
    const year = new Date().getFullYear();
    let max = 0;
    for (const row of detailRows) {
      const match = /INC-(\d+)-(\d{4})/i.exec(row.values[0] ?? "");
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `INC-${String(max + 1).padStart(4, "0")}-${year}`;
  };

  const openIncidentDialog = () => {
    if (detailColumns.length === 0) return;
    const form: Record<string, string> = {};
    for (const column of detailColumns) form[column] = "";

    const numberColumn = detailColumns[0];
    if (numberColumn) form[numberColumn] = nextIncidentNumber();

    const dateColumn = detailColumns.find((column) => /fecha/i.test(column));
    if (dateColumn) {
      form[dateColumn] = new Date().toLocaleDateString("es-CR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }

    const timeColumn = detailColumns.find((column) => /hora/i.test(column));
    if (timeColumn) {
      form[timeColumn] = new Date().toLocaleTimeString("es-CR", { hour12: false });
    }

    const eventColumn = detailColumns.find((column) => /evento/i.test(column));
    if (eventColumn) form[eventColumn] = "Otros";

    setIncidentForm(form);
    setIncidentError(null);
    setShowIncidentDialog(true);
  };

  const submitIncident = async (event: FormEvent) => {
    event.preventDefault();
    if (!Object.values(incidentForm).some((value) => value.trim().length > 0)) {
      setIncidentError("Completá al menos un campo de la incidencia.");
      return;
    }

    setIncidentSaving(true);
    setIncidentError(null);
    try {
      const response = await fetch("/api/informes-mensuales/incidencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ source: summarySource, data: incidentForm }),
      });
      if (!response.ok) throw new Error(await readError(response));

      setShowIncidentDialog(false);
      setMessage("Incidencia agregada correctamente.");
      await loadIncidents(summarySource);
    } catch (err) {
      setIncidentError(err instanceof Error ? err.message : "No se pudo guardar la incidencia");
    } finally {
      setIncidentSaving(false);
    }
  };

  const removeIncident = async (id: string) => {
    if (!window.confirm("¿Eliminar esta incidencia?")) return;

    setDeletingIncidentId(id);
    setIncidentsError(null);
    try {
      const response = await fetch(`/api/informes-mensuales/incidencias/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await readError(response));
      setMessage("Incidencia eliminada.");
      await loadIncidents(summarySource);
    } catch (err) {
      setIncidentsError(err instanceof Error ? err.message : "No se pudo eliminar la incidencia");
    } finally {
      setDeletingIncidentId(null);
    }
  };

  return (
    <>
      <Topbar title="Informes Mensuales" />
      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Informes Mensuales</h1>
          <p className="text-sm text-muted-foreground">
            Descargá la plantilla base, completala con la información del mes y subí el archivo.
            Cada entrega queda registrada con su período.
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-5 w-5" />
                Plantilla base
              </CardTitle>
              <CardDescription>
                Formato oficial en Excel para el informe mensual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Descargá el archivo, completá la información del mes y subilo en la sección de
                carga.
              </p>
              <Button asChild>
                <a href="/api/informes-mensuales/plantilla">
                  <Download className="h-4 w-4" />
                  Descargar plantilla Excel
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="h-5 w-5" />
                Subir informe del mes
              </CardTitle>
              <CardDescription>Excel, PDF o CSV. Máximo 20 MB.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="period">Mes</Label>
                    <Input
                      id="period"
                      type="month"
                      value={period}
                      onChange={(event) => setPeriod(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="report-file">Archivo</Label>
                    <Input
                      key={fileInputKey}
                      id="report-file"
                      type="file"
                      accept=".xlsx,.xls,.pdf,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf,text/csv"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-note">Nota (opcional)</Label>
                  <Input
                    id="report-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Observaciones del informe"
                    maxLength={500}
                  />
                </div>
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Subir informe
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Historial de informes</CardTitle>
              <CardDescription>{reports.length} archivo(s) cargado(s)</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="year-filter" className="text-xs text-muted-foreground">
                Año
              </Label>
              <select
                id="year-filter"
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="all">Todos</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}

            {!loading && grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay informes cargados.
              </p>
            ) : null}

            {grouped.map(([groupPeriod, items]) => (
              <div key={groupPeriod} className="space-y-2">
                <h3 className="text-sm font-semibold">{periodLabel(groupPeriod)}</h3>
                <ul className="divide-y rounded-lg border">
                  {items.map((report) => (
                    <li
                      key={report.id}
                      className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                    >
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{report.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(report.sizeBytes)} · {report.uploadedByName} ·{" "}
                          {formatDate(report.createdAt)}
                          {report.note ? ` · ${report.note}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline">{periodLabel(report.period)}</Badge>
                      <Button asChild variant="outline" size="sm">
                        <a href={report.downloadUrl}>
                          <Download className="h-3.5 w-3.5" />
                          Descargar
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void remove(report.id)}
                        disabled={deletingId === report.id}
                        aria-label="Eliminar informe"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Resumen de incidencias</CardTitle>
                <CardDescription>
                  Se lee la hoja «INFORME DEL MONTE» del Excel. Se muestran todas las columnas,
                  incluidas las que se agreguen.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="summary-source" className="text-xs text-muted-foreground">
                  Fuente
                </Label>
                <select
                  id="summary-source"
                  value={summarySource}
                  onChange={(event) => setSummarySource(event.target.value)}
                  className="h-9 max-w-[320px] rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="base">Plantilla base</option>
                  {reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {periodLabel(report.period)} · {report.fileName}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={openIncidentDialog}
                  disabled={detailColumns.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  Nueva incidencia
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {summaryLoading ? (
              <p className="text-sm text-muted-foreground">Leyendo el Excel…</p>
            ) : null}

            {summaryError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {summaryError}
              </div>
            ) : null}

            {incidentsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {incidentsError}
              </div>
            ) : null}

            {summary && !summaryLoading ? (
              <>
                {summary.detail ? (
                  <section>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Detalle de incidencias ({filteredRows.length} de {detailRows.length})
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Hoja «{summary.detail.sheetName}» · {summary.detail.columns.length}{" "}
                          columnas (incluye las agregadas).
                          {incidents.length > 0
                            ? ` ${incidents.length} agregada(s) manualmente.`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {filtersActive ? (
                          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                            Limpiar filtros
                          </Button>
                        ) : null}
                        {incidentsLoading ? (
                          <span className="text-xs text-muted-foreground">Cargando…</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2 max-h-[560px] overflow-auto rounded-lg border">
                      <table className="min-w-full text-xs">
                        <thead className="sticky top-0 z-20 bg-muted/90">
                          <tr>
                            {detailColumns.map((column, index) => (
                              <th
                                key={`${column}-${index}`}
                                className="whitespace-nowrap px-2 py-1.5 text-left font-semibold"
                              >
                                {column}
                              </th>
                            ))}
                            <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">
                              Acciones
                            </th>
                          </tr>
                          <tr>
                            {detailColumns.map((column, index) => (
                              <th key={`filter-${column}-${index}`} className="px-1 py-1">
                                {filterOptions[index] ? (
                                  <select
                                    value={filters[column] ?? ""}
                                    onChange={(event) =>
                                      setFilters((current) => ({
                                        ...current,
                                        [column]: event.target.value,
                                      }))
                                    }
                                    className="h-7 w-full min-w-[90px] rounded border border-input bg-background px-1 text-[11px]"
                                  >
                                    <option value="">Todos</option>
                                    {filterOptions[index]!.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    value={filters[column] ?? ""}
                                    onChange={(event) =>
                                      setFilters((current) => ({
                                        ...current,
                                        [column]: event.target.value,
                                      }))
                                    }
                                    placeholder="Filtrar…"
                                    className="h-7 w-full min-w-[90px] rounded border border-input bg-background px-1 text-[11px]"
                                  />
                                )}
                              </th>
                            ))}
                            <th className="px-1 py-1 text-[11px] font-normal text-muted-foreground">
                              {filtersActive ? `${filteredRows.length}/${detailRows.length}` : ""}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filteredRows.map((row, rowIndex) => (
                            <tr
                              key={row.manualId ?? `row-${rowIndex}`}
                              className={`align-top hover:bg-muted/30 ${
                                row.manualId ? "bg-amber-50/50" : ""
                              }`}
                            >
                              {row.values.map((value, columnIndex) => (
                                <td
                                  key={`cell-${rowIndex}-${columnIndex}`}
                                  className="max-w-[320px] truncate px-2 py-1.5"
                                  title={value}
                                >
                                  {value || "—"}
                                </td>
                              ))}
                              <td className="px-2 py-1.5">
                                {row.manualId ? (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary">Manual</Badge>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => void removeIncident(row.manualId!)}
                                      disabled={deletingIncidentId === row.manualId}
                                      aria-label="Eliminar incidencia"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredRows.length === 0 ? (
                        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                          {detailRows.length === 0
                            ? "No hay incidencias."
                            : "No hay incidencias que coincidan con los filtros."}
                        </p>
                      ) : null}
                    </div>
                  </section>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No se encontró la hoja «INFORME DEL MONTE».
                  </p>
                )}

                <p className="text-[11px] text-muted-foreground">
                  Fuente: {summary.source.fileName}
                  {summary.source.period ? ` · ${periodLabel(summary.source.period)}` : " (plantilla base)"}
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva incidencia</DialogTitle>
            <DialogDescription>
              Completá las columnas del informe. Se guarda como incidencia manual y se agrega al
              detalle.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitIncident} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {detailColumns.map((column, index) => {
                const longField = /descrip|acci|plan|observ|detalle/i.test(column);
                return (
                  <div
                    key={`${column}-${index}`}
                    className={longField ? "space-y-1 md:col-span-2" : "space-y-1"}
                  >
                    <Label htmlFor={`incident-field-${index}`}>{column}</Label>
                    {longField ? (
                      <Textarea
                        id={`incident-field-${index}`}
                        rows={3}
                        value={incidentForm[column] ?? ""}
                        onChange={(event) =>
                          setIncidentForm((current) => ({
                            ...current,
                            [column]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <Input
                        id={`incident-field-${index}`}
                        value={incidentForm[column] ?? ""}
                        onChange={(event) =>
                          setIncidentForm((current) => ({
                            ...current,
                            [column]: event.target.value,
                          }))
                        }
                        required={index === 0}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {incidentError ? <p className="text-sm text-red-600">{incidentError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowIncidentDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={incidentSaving}>
                {incidentSaving ? "Guardando…" : "Guardar incidencia"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
