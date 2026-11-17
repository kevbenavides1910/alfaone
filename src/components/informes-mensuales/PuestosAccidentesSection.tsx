"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
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

type PuestosAccidentesReport = {
  columns: string[];
  rows: string[][];
  meta: {
    total: number;
    baseConsecutive: number;
    firstConsecutive: string | null;
    lastConsecutive: string | null;
    year: number;
    sources: { puestos: number; accidentes: number; manual: number };
  };
};

async function readError(response: Response) {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ?? "Error inesperado";
  } catch {
    return "Error inesperado";
  }
}

export function PuestosAccidentesSection() {
  const [report, setReport] = useState<PuestosAccidentesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/informes-mensuales/puestos-accidentes", {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(await readError(response));
      const json = (await response.json()) as { data?: PuestosAccidentesReport };
      setReport(json.data ?? null);
      setFilters({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(() => report?.columns ?? [], [report]);
  const rows = useMemo(() => report?.rows ?? [], [report]);

  const filterOptions = useMemo(
    () =>
      columns.map((_, index) => {
        const values = Array.from(
          new Set(rows.map((row) => row[index]).filter(Boolean)),
        );
        return values.length > 0 && values.length <= 25
          ? values.sort((a, b) => a.localeCompare(b, "es"))
          : null;
      }),
    [columns, rows],
  );

  const filtersActive = Object.values(filters).some((value) => value.trim().length > 0);

  const filteredRows = useMemo(() => {
    if (!filtersActive) return rows;
    return rows.filter((row) =>
      columns.every((column, index) => {
        const filter = filters[column]?.trim().toLowerCase();
        if (!filter) return true;
        return (row[index] ?? "").toLowerCase().includes(filter);
      }),
    );
  }, [rows, columns, filters, filtersActive]);

  const setField = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openDialog = () => {
    const now = new Date();
    setForm({
      Fecha: now.toLocaleDateString("es-CR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      Incidente: "",
      Administrador: "",
      "Acción Inmediata": "",
      Cliente: "",
      Hora: now.toLocaleTimeString("es-CR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      Zona: "",
      Informe: "No",
      Investigación: "No",
      Status: "Abierto",
      Fuente: "Puestos",
    });
    setFormError(null);
    setShowDialog(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.Incidente?.trim()) {
      setFormError("Ingresá el incidente.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/informes-mensuales/incidencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ source: "puestos-accidentes", data: form }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setShowDialog(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la incidencia");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Incidencias de Puestos y Accidentes
          </h2>
          <p className="text-sm text-muted-foreground">
            Reporte consolidado de las hojas «Reporte Incidencias De Puestos» y «Reporte
            Incidencias De Accidentes».
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openDialog}>
            <Plus className="h-4 w-4" />
            Nueva incidencia
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total de incidencias</p>
              <p className="text-2xl font-semibold tabular-nums">{report.meta.total}</p>
              <p className="text-[11px] text-muted-foreground">
                Puestos {report.meta.sources.puestos} · Accidentes{" "}
                {report.meta.sources.accidentes}
                {report.meta.sources.manual > 0
                  ? ` · Manuales ${report.meta.sources.manual}`
                  : ""}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Base Del Monte</p>
              <p className="text-2xl font-semibold tabular-nums">
                {report.meta.baseConsecutive}
              </p>
              <p className="text-[11px] text-muted-foreground">incidencias ya numeradas</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Consecutivo asignado</p>
              <p className="text-sm font-semibold">
                {report.meta.firstConsecutive ?? "—"} – {report.meta.lastConsecutive ?? "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">ordenado por fecha</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Año del reporte</p>
              <p className="text-2xl font-semibold tabular-nums">{report.meta.year}</p>
              <p className="text-[11px] text-muted-foreground">
                cuenta Del Monte + archivo adjunto
              </p>
            </div>
          </div>

          <Card>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Detalle consolidado</CardTitle>
                  <CardDescription>
                    El consecutivo se asigna por fecha y toma en cuenta las incidencias de Del
                    Monte (base {report.meta.baseConsecutive}) más las de este archivo.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {filtersActive ? (
                    <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                      Limpiar filtros
                    </Button>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {filteredRows.length} de {rows.length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Leyendo el archivo…</p>
              ) : null}

              <div className="max-h-[640px] overflow-auto rounded-lg border">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-20 bg-muted/90">
                    <tr>
                      {columns.map((column, index) => (
                        <th
                          key={`${column}-${index}`}
                          className="whitespace-nowrap px-2 py-1.5 text-left font-semibold"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {columns.map((column, index) => (
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
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="align-top hover:bg-muted/30">
                        {row.map((value, columnIndex) => (
                          <td
                            key={`cell-${rowIndex}-${columnIndex}`}
                            className="max-w-[360px] truncate px-2 py-1.5"
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

              {filteredRows.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No hay incidencias que coincidan con los filtros.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva incidencia</DialogTitle>
            <DialogDescription>
              Se agrega al reporte de Puestos y Accidentes y se incluye en el consecutivo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="pa-fecha">Fecha</Label>
                <Input
                  id="pa-fecha"
                  value={form.Fecha ?? ""}
                  onChange={(event) => setField("Fecha", event.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pa-hora">Hora</Label>
                <Input
                  id="pa-hora"
                  value={form.Hora ?? ""}
                  onChange={(event) => setField("Hora", event.target.value)}
                  placeholder="hh:mm"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="pa-incidente">Incidente</Label>
                <Textarea
                  id="pa-incidente"
                  rows={3}
                  value={form.Incidente ?? ""}
                  onChange={(event) => setField("Incidente", event.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pa-administrador">Administrador</Label>
                <Input
                  id="pa-administrador"
                  value={form.Administrador ?? ""}
                  onChange={(event) => setField("Administrador", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pa-cliente">Cliente</Label>
                <Input
                  id="pa-cliente"
                  value={form.Cliente ?? ""}
                  onChange={(event) => setField("Cliente", event.target.value)}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="pa-accion">Acción Inmediata</Label>
                <Textarea
                  id="pa-accion"
                  rows={3}
                  value={form["Acción Inmediata"] ?? ""}
                  onChange={(event) => setField("Acción Inmediata", event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pa-zona">Zona</Label>
                <Input
                  id="pa-zona"
                  value={form.Zona ?? ""}
                  onChange={(event) => setField("Zona", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pa-fuente">Fuente</Label>
                <select
                  id="pa-fuente"
                  value={form.Fuente ?? "Puestos"}
                  onChange={(event) => setField("Fuente", event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Puestos">Puestos</option>
                  <option value="Accidentes">Accidentes</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="pa-informe">Informe</Label>
                <select
                  id="pa-informe"
                  value={form.Informe ?? "No"}
                  onChange={(event) => setField("Informe", event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Si">Si</option>
                  <option value="No">No</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pa-investigacion">Investigación</Label>
                <select
                  id="pa-investigacion"
                  value={form.Investigación ?? "No"}
                  onChange={(event) => setField("Investigación", event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Si">Si</option>
                  <option value="No">No</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pa-status">Status</Label>
                <select
                  id="pa-status"
                  value={form.Status ?? "Abierto"}
                  onChange={(event) => setField("Status", event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Abierto">Abierto</option>
                  <option value="Cerrado">Cerrado</option>
                </select>
              </div>
            </div>

            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Guardar incidencia"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
