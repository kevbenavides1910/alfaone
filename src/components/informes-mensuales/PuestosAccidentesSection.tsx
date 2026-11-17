"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PuestosAccidentesReport = {
  columns: string[];
  rows: string[][];
  meta: {
    total: number;
    baseConsecutive: number;
    firstConsecutive: string | null;
    lastConsecutive: string | null;
    year: number;
    sources: { puestos: number; accidentes: number };
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
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? "Actualizando…" : "Actualizar"}
        </Button>
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
    </div>
  );
}
