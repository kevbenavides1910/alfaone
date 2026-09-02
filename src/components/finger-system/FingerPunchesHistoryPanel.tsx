"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDateTime } from "@/lib/utils/format";
import { fingerApiUrl, useFingerCompany } from "@/components/finger-system/finger-company-context";
import type { FingerPunchListRow } from "@/modules/finger-system/services/finger-punches-list";

type ListResponse = {
  data: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    rows: FingerPunchListRow[];
  };
};

const TABLE_ID = "finger-punches-history";

export function FingerPunchesHistoryPanel() {
  const { companyCode } = useFingerCompany();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "50");
    if (q.trim()) sp.set("q", q.trim());
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (source === "DEVICE" || source === "ATT2016") sp.set("source", source);
    return sp.toString();
  }, [q, from, to, source, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["finger-punches", queryParams, companyCode],
    queryFn: async () => {
      const res = await fetch(fingerApiUrl(`/api/finger-system/punches?${queryParams}`, companyCode), {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar marcas");
      return json as ListResponse;
    },
    placeholderData: keepPreviousData,
  });

  const rows = data?.data.rows ?? [];
  const payload = data?.data;

  const columnDefs = useMemo((): TableColumnFilterDef<FingerPunchListRow>[] => {
    return [
      { key: "checkTime", label: "Fecha/hora", getValue: (r) => formatDateTime(r.checkTime) },
      { key: "badge", label: "Badge", getValue: (r) => r.badgeNumber ?? String(r.attUserId) },
      { key: "employee", label: "Empleado", getValue: (r) => r.employeeName ?? "" },
      { key: "device", label: "Reloj", getValue: (r) => r.deviceName ?? r.deviceSn ?? "" },
      { key: "source", label: "Origen", getValue: (r) => r.source },
      { key: "checkType", label: "Tipo", getValue: (r) => r.checkType ?? "" },
    ];
  }, []);

  const displayedRows = useMemo(
    () =>
      filterRowsByColumnFilters(
        rows,
        columnFilters,
        columnDefs.map((c) => ({ key: c.key, getValue: c.getValue, mode: c.mode, filterable: c.filterable })),
      ),
    [rows, columnDefs, columnFilters],
  );

  const columnFilterKeys = useMemo(() => columnDefs.map((c) => c.key), [columnDefs]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <Input
            className="h-9 w-56"
            placeholder="Badge, nombre, código…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input
            type="date"
            className="h-9"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input
            type="date"
            className="h-9"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Origen</label>
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="DEVICE">Reloj ZK</option>
            <option value="ATT2016">ATT2016</option>
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!displayedRows.length}
          onClick={() =>
            exportRowsToExcel({
              filename: "finger_marcas",
              sheetName: "Marcas",
              rows: displayedRows.map((r) => ({
                Fecha: formatDateTime(r.checkTime),
                Badge: r.badgeNumber ?? r.attUserId,
                Empleado: r.employeeName ?? "",
                Codigo: r.employeeCodigo ?? "",
                Reloj: r.deviceName ?? r.deviceSn ?? "",
                Origen: r.source,
                Tipo: r.checkType ?? "",
              })),
            })
          }
        >
          Excel ({displayedRows.length})
        </Button>
        {isFetching && !isLoading ? (
          <span className="text-xs text-muted-foreground self-center">Actualizando…</span>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-[calc(100vh-16rem)] overflow-auto">
          {hasActiveColumnFilters(columnFilters) ? (
            <div className="flex justify-end px-3 py-1.5 border-b bg-slate-50">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setColumnFilters(clearColumnFilters(columnFilterKeys))}
              >
                Limpiar filtros
              </Button>
            </div>
          ) : null}
          <table data-table-id={TABLE_ID} className="w-full text-sm">
            <thead>
              <TableColumnFilterHead
                tableId={TABLE_ID}
                defaultColumnWidths={{
                  checkTime: 140,
                  badge: 100,
                  employee: 220,
                  device: 160,
                  source: 90,
                  checkType: 80,
                }}
                columns={columnDefs}
                rows={rows}
                filters={columnFilters}
                onFilterChange={(k, v) => setColumnFilters((p) => ({ ...p, [k]: v }))}
                filterRowClassName="bg-slate-50"
              />
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Cargando marcas…
                  </td>
                </tr>
              ) : null}
              {!isLoading && displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No hay marcas con los filtros actuales. Use «Traer marcas» en Dispositivos o espere el sync.
                  </td>
                </tr>
              ) : null}
              {displayedRows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(row.checkTime)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.badgeNumber ?? row.attUserId}</td>
                  <td className="px-3 py-2">
                    {row.employeeName ?? "—"}
                    {row.employeeCodigo ? (
                      <span className="text-xs text-muted-foreground"> · {row.employeeCodigo}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.deviceName ?? row.deviceSn ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{row.source === "DEVICE" ? "Reloj ZK" : "ATT2016"}</td>
                  <td className="px-3 py-2 text-xs">{row.checkType ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payload && payload.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {payload.page} de {payload.totalPages} ({payload.total} marcas)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= payload.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
