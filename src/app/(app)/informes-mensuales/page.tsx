"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Trash2, Upload } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type AnnualIncidentSummary = {
  title: string;
  year: string;
  engineer: string;
  months: string[];
  rows: { label: string; values: number[]; total: number }[];
  totals: { values: number[]; total: number };
};

type IncidentDetailSummary = {
  sheetName: string;
  columns: string[];
  rows: string[][];
};

type IncidentSummary = {
  source: { kind: "base" | "upload"; fileName: string; period: string | null };
  annual: AnnualIncidentSummary | null;
  detail: IncidentDetailSummary | null;
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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary(summarySource);
  }, [loadSummary, summarySource]);

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

  const totalIncidents = summary?.annual?.totals.total ?? 0;
  const typeCount = summary?.annual?.rows.length ?? 0;
  const detailCount = summary?.detail?.rows.length ?? 0;

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
                  Se leen las hojas «Informe Anual» e «INFORME DEL MONTE». Se muestran todas las
                  columnas del Excel, incluidas las que se agreguen.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
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

            {summary && !summaryLoading ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Total de incidencias</p>
                    <p className="text-2xl font-semibold tabular-nums">{totalIncidents}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Tipos de incidencia</p>
                    <p className="text-2xl font-semibold tabular-nums">{typeCount}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Registros detallados</p>
                    <p className="text-2xl font-semibold tabular-nums">{detailCount}</p>
                  </div>
                </div>

                {summary.annual ? (
                  <section>
                    <h3 className="text-sm font-semibold">
                      {summary.annual.title}
                      {summary.annual.year ? ` · ${summary.annual.year}` : ""}
                    </h3>
                    {summary.annual.engineer ? (
                      <p className="text-xs text-muted-foreground">{summary.annual.engineer}</p>
                    ) : null}
                    <div className="mt-2 overflow-x-auto rounded-lg border">
                      <table className="min-w-full text-xs">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold">
                              Tipo de incidencia
                            </th>
                            {summary.annual.months.map((month, index) => (
                              <th
                                key={`${month}-${index}`}
                                className="whitespace-nowrap px-2 py-1.5 text-right font-semibold"
                              >
                                {month}
                              </th>
                            ))}
                            <th className="px-2 py-1.5 text-right font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {summary.annual.rows.map((row) => (
                            <tr key={row.label} className="hover:bg-muted/30">
                              <td className="px-2 py-1.5 font-medium">{row.label}</td>
                              {row.values.map((value, index) => (
                                <td
                                  key={`${row.label}-${index}`}
                                  className="px-2 py-1.5 text-right tabular-nums"
                                >
                                  {value || "—"}
                                </td>
                              ))}
                              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                                {row.total || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t bg-muted/40 font-semibold">
                          <tr>
                            <td className="px-2 py-1.5">Total</td>
                            {summary.annual.totals.values.map((value, index) => (
                              <td
                                key={`total-${index}`}
                                className="px-2 py-1.5 text-right tabular-nums"
                              >
                                {value}
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {summary.annual.totals.total}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No se encontró la hoja «Informe Anual».
                  </p>
                )}

                {summary.detail ? (
                  <section>
                    <h3 className="text-sm font-semibold">
                      Detalle de incidencias ({summary.detail.rows.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Hoja «{summary.detail.sheetName}» · {summary.detail.columns.length} columnas
                      (incluye las agregadas).
                    </p>
                    <div className="mt-2 max-h-[520px] overflow-auto rounded-lg border">
                      <table className="min-w-full text-xs">
                        <thead className="sticky top-0 z-10 bg-muted/80">
                          <tr>
                            {summary.detail.columns.map((column, index) => (
                              <th
                                key={`${column}-${index}`}
                                className="whitespace-nowrap px-2 py-1.5 text-left font-semibold"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {summary.detail.rows.map((row, rowIndex) => (
                            <tr key={`row-${rowIndex}`} className="align-top hover:bg-muted/30">
                              {row.map((value, columnIndex) => (
                                <td
                                  key={`cell-${rowIndex}-${columnIndex}`}
                                  className="max-w-[320px] truncate px-2 py-1.5"
                                  title={value}
                                >
                                  {value || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
    </>
  );
}
