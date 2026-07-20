"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { cn } from "@/lib/utils/cn";

type TrackEstado = "PENDIENTE" | "EN_PROCESO" | "COMPLETADO" | "NO_APLICA";
type EstadoEfectivo = TrackEstado | "EN_EXPEDIENTE";

type Item = {
  noEmple: string;
  cedula: string;
  nombre: string;
  noCia: string;
  puesto: string;
  fIngreso: string | null;
  zona: string;
  zonaCode: string;
  ubicacionNombre: string;
  hasE5Live: boolean;
  e5Path: string | null;
  track: {
    noEmple: string;
    estado: TrackEstado;
    notas: string;
    updatedBy?: string;
    updatedAt?: string;
  };
  estadoEfectivo: EstadoEfectivo;
};

type ListResponse = {
  data: {
    root: string;
    baselineAt: string | null;
    smbConfigured: boolean;
    items: Item[];
    summary: {
      total: number;
      pendientes: number;
      enProceso: number;
      completados: number;
      noAplica: number;
      enExpediente: number;
      sinZona: number;
      porZona: Record<string, number>;
    };
  };
};

const ESTADO_LABEL: Record<EstadoEfectivo, string> = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  COMPLETADO: "Completado",
  NO_APLICA: "No aplica",
  EN_EXPEDIENTE: "Ya en expediente",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: { message?: string } })?.error?.message || `Error ${res.status}`);
  }
  return body as T;
}

export function FaltantesE5Tracking() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session, "empleados.contratos", "edit");
  const queryClient = useQueryClient();
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [hideEnExpediente, setHideEnExpediente] = useState(true);
  const [editingNotas, setEditingNotas] = useState<Record<string, string>>({});

  const listQuery = useQuery({
    queryKey: ["faltantes-e5"],
    queryFn: () =>
      fetchJson<ListResponse>(
        "/api/empleados/contratos/faltantes-e5?includeEnExpediente=1",
      ),
  });

  const allItems = listQuery.data?.data.items ?? [];
  const items = hideEnExpediente
    ? allItems.filter((r) => !r.hasE5Live)
    : allItems;
  const summary = listQuery.data?.data.summary;
  const baselineAt = listQuery.data?.data.baselineAt;
  const smbConfigured = listQuery.data?.data.smbConfigured ?? false;

  const statusMutation = useMutation({
    mutationFn: async (payload: { noEmple: string; estado: TrackEstado; notas?: string }) => {
      return fetchJson("/api/empleados/contratos/faltantes-e5/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["faltantes-e5"] });
    },
    onError: (e: Error) => toast.error(e.message || "Error al guardar"),
  });

  const refreshMutation = useMutation({
    mutationFn: async () =>
      fetchJson<{ data: { baselineAt: string; total: number } }>(
        "/api/empleados/contratos/faltantes-e5/refresh",
        { method: "POST" },
      ),
    onSuccess: (res) => {
      toast.success(`Lista refresada: ${res.data.total} empleados`);
      queryClient.invalidateQueries({ queryKey: ["faltantes-e5"] });
    },
    onError: (e: Error) => toast.error(e.message || "Error al refrescar"),
  });

  const columnDefs: TableColumnFilterDef<Item>[] = useMemo(
    () => [
      {
        key: "noEmple",
        label: "No. emple",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap",
        getValue: (r) => r.noEmple,
      },
      {
        key: "nombre",
        label: "Nombre",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
        getValue: (r) => r.nombre,
      },
      {
        key: "cedula",
        label: "Cédula",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap",
        getValue: (r) => r.cedula,
      },
      {
        key: "zona",
        label: "Zona",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap",
        getValue: (r) => r.zona || "(sin zona)",
      },
      {
        key: "puesto",
        label: "Puesto",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
        getValue: (r) => r.puesto,
      },
      {
        key: "fIngreso",
        label: "Ingreso",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap",
        getValue: (r) => r.fIngreso ?? "",
      },
      {
        key: "noCia",
        label: "Cia",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap",
        getValue: (r) => r.noCia,
      },
      {
        key: "estado",
        label: "Estado",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap",
        getValue: (r) => ESTADO_LABEL[r.estadoEfectivo],
      },
      {
        key: "notas",
        label: "Notas",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
        getValue: (r) => r.track.notas,
      },
      {
        key: "actions",
        label: "Actualizar",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap",
        filterable: false,
        getValue: () => "",
      },
    ],
    [],
  );

  const displayedRows = filterRowsByColumnFilters(items, columnFilters, columnDefs);

  function exportExcel() {
    const rows = displayedRows.map((r) => ({
      "No. emple": r.noEmple,
      Nombre: r.nombre,
      Cédula: r.cedula,
      Zona: r.zona || "(sin zona)",
      "Código zona": r.zonaCode,
      Ubicación: r.ubicacionNombre,
      Puesto: r.puesto,
      Ingreso: r.fIngreso ?? "",
      Cia: r.noCia,
      "Estado seguimiento": ESTADO_LABEL[r.estadoEfectivo],
      "E5 en expediente": r.hasE5Live ? "Sí" : "No",
      "Ruta E5": r.e5Path ?? "",
      Notas: r.track.notas,
      "Actualizado por": r.track.updatedBy ?? "",
      "Actualizado el": r.track.updatedAt ?? "",
    }));
    exportRowsToExcel({
      filename: "activos_sin_e5",
      sheetName: "Sin E5",
      rows,
      columnWidths: [12, 36, 14, 16, 12, 24, 22, 12, 8, 16, 10, 28, 30, 22, 20],
    });
  }

  const porZonaSorted = useMemo(() => {
    const entries = Object.entries(summary?.porZona ?? {});
    entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
    return entries;
  }, [summary?.porZona]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <Topbar title="Activos sin E5 — seguimiento por zona" />
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1 text-sm text-slate-600 max-w-3xl">
            <p>
              Lista de empleados activos NAF sin contrato E5 en el expediente digital. La{" "}
              <strong className="text-slate-800">zona</strong> es la misma de Empleados NAF
              (<code className="mx-1 text-xs">NafEmployee.zona</code>).
            </p>
            <p className="text-xs text-slate-500">
              Baseline: {baselineAt ? new Date(baselineAt).toLocaleString("es-CR") : "—"}
              {!smbConfigured ? " · SMB expediente no configurado" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 text-sm text-slate-600 mr-2">
              <input
                type="checkbox"
                checked={hideEnExpediente}
                onChange={(e) => setHideEnExpediente(e.target.checked)}
              />
              Ocultar ya en expediente
            </label>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!items.length}
              onClick={exportExcel}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel ({displayedRows.length})
            </Button>
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={refreshMutation.isPending}
                onClick={() => {
                  if (
                    confirm(
                      "¿Refrescar la lista cruzando activos NAF contra el expediente E5 vivo? Se conservan los estados/notas ya marcados.",
                    )
                  ) {
                    refreshMutation.mutate();
                  }
                }}
              >
                {refreshMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Actualizar desde expediente
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              disabled={listQuery.isFetching}
              onClick={() => listQuery.refetch()}
            >
              {listQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recargar
            </Button>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            {[
              { label: "Total", value: summary.total, className: "bg-slate-100 text-slate-800" },
              { label: "Pendientes", value: summary.pendientes, className: "bg-amber-50 text-amber-900" },
              { label: "En proceso", value: summary.enProceso, className: "bg-blue-50 text-blue-900" },
              { label: "Completados", value: summary.completados, className: "bg-emerald-50 text-emerald-900" },
              { label: "No aplica", value: summary.noAplica, className: "bg-slate-50 text-slate-600" },
              { label: "En expediente", value: summary.enExpediente, className: "bg-green-50 text-green-900" },
              { label: "Sin zona", value: summary.sinZona, className: "bg-rose-50 text-rose-900" },
            ].map((c) => (
              <div key={c.label} className={cn("rounded-lg px-3 py-2", c.className)}>
                <div className="text-xs opacity-80">{c.label}</div>
                <div className="text-xl font-semibold tabular-nums">{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {porZonaSorted.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {porZonaSorted.map(([zona, n]) => (
              <Badge
                key={zona}
                variant="secondary"
                className="cursor-pointer"
                onClick={() =>
                  setColumnFilters((s) => ({
                    ...s,
                    zona: zona === "(sin zona)" ? "(sin zona)" : zona,
                  }))
                }
              >
                {zona}: {n}
              </Badge>
            ))}
          </div>
        )}

        {listQuery.isLoading ? (
          <div className="p-10 text-center text-slate-400">Cargando lista…</div>
        ) : listQuery.isError ? (
          <div className="p-6 text-center text-red-600 border rounded-lg">
            {(listQuery.error as Error).message}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-400 border rounded-lg">
            No hay empleados en la lista con los filtros actuales.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="max-h-[calc(100vh-22rem)] overflow-auto">
              <table data-table-id="faltantes-e5" className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <TableColumnFilterHead
                    tableId="faltantes-e5"
                    columns={columnDefs}
                    rows={items}
                    filters={columnFilters}
                    onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                  />
                </thead>
                <tbody className="divide-y">
                  {displayedRows.map((r) => {
                    const notasValue = editingNotas[r.noEmple] ?? r.track.notas;
                    const locked = r.hasE5Live;
                    return (
                      <tr key={r.noEmple} className="hover:bg-muted/40">
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.noEmple}</td>
                        <td className="px-3 py-2 whitespace-nowrap" title={r.nombre}>
                          {r.nombre || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                          {r.cedula || "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.zona ? (
                            <span className="font-medium text-slate-800">{r.zona}</span>
                          ) : (
                            <span className="text-rose-600 text-xs">sin zona</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" title={r.puesto}>
                          {r.puesto || "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">{r.fIngreso ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">{r.noCia || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Badge
                            variant={
                              r.estadoEfectivo === "EN_EXPEDIENTE" || r.estadoEfectivo === "COMPLETADO"
                                ? "success"
                                : r.estadoEfectivo === "EN_PROCESO"
                                  ? "default"
                                  : r.estadoEfectivo === "NO_APLICA"
                                    ? "secondary"
                                    : "warning"
                            }
                          >
                            {ESTADO_LABEL[r.estadoEfectivo]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 min-w-[10rem]">
                          <input
                            className="w-full border rounded px-2 py-1 text-xs disabled:bg-slate-50"
                            value={notasValue}
                            disabled={!canEdit || locked}
                            placeholder="Notas…"
                            onChange={(e) =>
                              setEditingNotas((s) => ({ ...s, [r.noEmple]: e.target.value }))
                            }
                            onBlur={() => {
                              if (!canEdit || locked) return;
                              const next = (editingNotas[r.noEmple] ?? r.track.notas).trim();
                              if (next === (r.track.notas || "").trim()) return;
                              statusMutation.mutate({
                                noEmple: r.noEmple,
                                estado: r.track.estado,
                                notas: next,
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {canEdit && !locked ? (
                            <select
                              className="border rounded px-2 py-1 text-xs"
                              value={r.track.estado}
                              disabled={statusMutation.isPending}
                              onChange={(e) => {
                                const estado = e.target.value as TrackEstado;
                                statusMutation.mutate({
                                  noEmple: r.noEmple,
                                  estado,
                                  notas: editingNotas[r.noEmple] ?? r.track.notas,
                                });
                              }}
                            >
                              <option value="PENDIENTE">Pendiente</option>
                              <option value="EN_PROCESO">En proceso</option>
                              <option value="COMPLETADO">Completado</option>
                              <option value="NO_APLICA">No aplica</option>
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-2 text-xs text-slate-500 border-t bg-slate-50">
              Mostrando {displayedRows.length} de {items.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
