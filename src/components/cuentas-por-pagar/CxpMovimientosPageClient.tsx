"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Download,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { cn } from "@/lib/utils/cn";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { CXP_DOCUMENTO_CLASE_LABELS } from "@/modules/cuentas-por-pagar/business/cxp-movimientos";
import type {
  CxpMovimientoRow,
  CxpMovimientosListResult,
} from "@/modules/cuentas-por-pagar/services/list-cxp-movimientos";
import type { CxpTiposDocResult } from "@/modules/cuentas-por-pagar/services/list-cxp-tipos-doc";
import type { CxpProveedoresListResult } from "@/modules/cuentas-por-pagar/services/list-cxp-proveedores";

const COMPANIES = [
  { code: "ALL", label: "Todas las compañías" },
  { code: "ACE", label: "ACE" },
  { code: "ALFA", label: "Alfa" },
  { code: "ALFATRONIC", label: "Alfatronic" },
  { code: "BENA", label: "Bena" },
  { code: "BENLO", label: "Benlo" },
  { code: "CONSORCIO", label: "Consorcio" },
  { code: "DESARROLLOS", label: "Desarrollos Constructivos" },
  { code: "JOBEN", label: "Joben" },
  { code: "MONITOREO", label: "Monitoreo" },
  { code: "TANGO", label: "Tango" },
];

const DOCUMENTO_CLASES = [
  { code: "ALL", label: "Todas las clases" },
  ...Object.entries(CXP_DOCUMENTO_CLASE_LABELS).map(([code, label]) => ({
    code,
    label: `${label} (${code})`,
  })),
];

const REFETCH_MS = 120_000;
const PAGE_SIZE = 50;
const COLSPAN = 12;

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoFirstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function CxpMovimientosPageClient() {
  const [dateFrom, setDateFrom] = useState(isoFirstOfMonth);
  const [dateTo, setDateTo] = useState(isoToday);
  const [company, setCompany] = useState("ALL");
  const [tipoDocs, setTipoDocs] = useState<string[]>([]);
  const [documentoClase, setDocumentoClase] = useState("ALL");
  const [noProve, setNoProve] = useState("ALL");
  const [proveedorSearch, setProveedorSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const tiposQuery = useQuery<{ data: CxpTiposDocResult }>({
    queryKey: ["cxp-tipos-doc"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const r = await fetch("/api/cuentas-por-pagar/tipos-doc");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar tipos");
      return json;
    },
  });

  const tipoOptions = useMemo(
    () =>
      (tiposQuery.data?.data?.rows ?? []).map((t) => ({
        value: t.tipoDoc,
        label: t.label,
      })),
    [tiposQuery.data],
  );

  const proveedoresQuery = useQuery<{ data: CxpProveedoresListResult }>({
    queryKey: ["cxp-proveedores", company, proveedorSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "150" });
      if (company !== "ALL") params.set("company", company);
      if (proveedorSearch.trim()) params.set("search", proveedorSearch.trim());
      const r = await fetch(`/api/cuentas-por-pagar/proveedores?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar proveedores");
      return json;
    },
  });

  const proveedorOptions = useMemo(
    () => [
      { value: "ALL", label: "Todos los proveedores" },
      ...(proveedoresQuery.data?.data?.rows ?? []).map((p) => ({
        value: p.noProve,
        label: `${p.nombre} (${p.noProve}${p.cedula ? ` · ${p.cedula}` : ""})`,
      })),
    ],
    [proveedoresQuery.data],
  );

  const queryKey = [
    "cxp-movimientos",
    dateFrom,
    dateTo,
    company,
    [...tipoDocs].sort().join(","),
    documentoClase,
    noProve,
    search,
    page,
  ];

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } = useQuery<{
    data: CxpMovimientosListResult;
  }>({
    queryKey,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (company !== "ALL") params.set("company", company);
      for (const t of tipoDocs) params.append("tipoDocs", t);
      if (documentoClase !== "ALL") params.set("documentoClase", documentoClase);
      if (noProve !== "ALL") params.set("noProve", noProve);
      if (search.trim()) params.set("search", search.trim());
      const r = await fetch(`/api/cuentas-por-pagar/movimientos?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar movimientos");
      return json;
    },
  });

  const result = data?.data;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = result?.summary;

  const columnDefs: TableColumnFilterDef<CxpMovimientoRow>[] = useMemo(
    () => [
      {
        key: "fecha",
        label: "Fecha",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => formatDate(r.fecha),
      },
      {
        key: "cia",
        label: "Cía",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.companyCode ?? r.noCia,
      },
      {
        key: "tipo",
        label: "Tipo",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.tipoDoc,
      },
      {
        key: "clase",
        label: "Clase",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.documentoClase ?? "",
      },
      {
        key: "noDocu",
        label: "Nº doc",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.noDocu,
      },
      {
        key: "noFisico",
        label: "Nº físico",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.noFisico ?? "",
      },
      {
        key: "proveedor",
        label: "Proveedor",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.proveedor,
      },
      {
        key: "detalle",
        label: "Detalle",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.detalle ?? r.concepto ?? "",
      },
      {
        key: "monto",
        label: "Monto",
        align: "right",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600 text-right",
        getValue: (r) => String(r.monto),
        filterable: false,
      },
      {
        key: "saldo",
        label: "Saldo",
        align: "right",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600 text-right",
        getValue: (r) => String(r.saldo),
        filterable: false,
      },
      {
        key: "moneda",
        label: "Moneda",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => r.monedaLabel,
      },
      {
        key: "anulado",
        label: "Anulado",
        headerClassName: "sticky top-0 z-10 bg-slate-50 px-3 py-2 font-medium text-slate-600",
        getValue: (r) => ((r.anulado ?? "N").toUpperCase() === "S" ? "Sí" : "No"),
      },
    ],
    [],
  );

  const displayedRows = useMemo(
    () => filterRowsByColumnFilters(rows, columnFilters, columnDefs),
    [rows, columnDefs, columnFilters],
  );
  const columnFilterKeys = columnDefs.map((c) => c.key);

  function onColumnFilterChange(key: string, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleExport() {
    exportRowsToExcel({
      filename: `cxp_movimientos_${dateFrom}_${dateTo}`,
      sheetName: "Movimientos",
      rows: displayedRows.map((r) => ({
        Fecha: formatDate(r.fecha),
        "Fecha documento": r.fechaDocumento ? formatDate(r.fechaDocumento) : "",
        Compañía: r.companyCode ?? r.noCia,
        Tipo: r.tipoDoc,
        "Desc. tipo": r.tipoDocDesc ?? "",
        Clase: r.documentoClase ?? "",
        "Nº documento": r.noDocu,
        "Nº físico": r.noFisico ?? "",
        Serie: r.serieFisico ?? "",
        Proveedor: r.proveedor,
        "Cód. proveedor": r.noProve,
        Cédula: r.cedula ?? "",
        Detalle: r.detalle ?? "",
        Concepto: r.concepto ?? "",
        Subtotal: r.subtotal,
        Monto: r.monto,
        Saldo: r.saldo,
        Moneda: r.monedaLabel,
        Anulado: (r.anulado ?? "N").toUpperCase() === "S" ? "Sí" : "No",
      })),
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Movimientos contables CXP</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Todos los movimientos de Codisa (
            <code className="text-xs bg-slate-100 px-1 rounded">NAF5.ARCPMD</code>
            ): facturas, NC, ND, transferencias, cheques, ajustes y demás tipos.
            Filtre por rango de fechas y tipo de movimiento.
          </p>
        </div>
        <div className="text-xs text-slate-500 text-right space-y-1">
          <p>Última consulta: {dataUpdatedAt ? formatDateTime(new Date(dataUpdatedAt)) : "—"}</p>
          {(isFetching || isLoading) && (
            <p className="flex items-center justify-end gap-1 text-red-600">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Actualizando…
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Desde</span>
              <CalendarDateInput
                value={dateFrom}
                onChange={(v) => {
                  setDateFrom(v);
                  setPage(1);
                }}
                showPicker
                className="w-[140px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Hasta</span>
              <CalendarDateInput
                value={dateTo}
                onChange={(v) => {
                  setDateTo(v);
                  setPage(1);
                }}
                showPicker
                className="w-[140px]"
              />
            </div>

            <Select
              value={company}
              onValueChange={(v) => {
                setCompany(v);
                setNoProve("ALL");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Compañía" />
              </SelectTrigger>
              <SelectContent>
                {COMPANIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="min-w-[240px] max-w-[360px] flex-1">
              <MultiSelect
                options={tipoOptions}
                value={tipoDocs}
                onChange={(v) => {
                  setTipoDocs(v);
                  setPage(1);
                }}
                placeholder={tiposQuery.isLoading ? "Cargando tipos…" : "Tipos (NC, ND, FA…)"}
              />
            </div>

            <Select
              value={documentoClase}
              onValueChange={(v) => {
                setDocumentoClase(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Clase" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENTO_CLASES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="min-w-[240px] max-w-[320px] flex-1 space-y-1">
              <SearchableSelect
                options={proveedorOptions}
                value={noProve}
                onChange={(v) => {
                  setNoProve(v);
                  setPage(1);
                }}
                placeholder="Proveedor…"
                searchHint="Buscar por nombre, código o cédula"
                emptyMessage="Sin proveedores (escriba para filtrar la lista)"
              />
              <Input
                value={proveedorSearch}
                onChange={(e) => setProveedorSearch(e.target.value)}
                placeholder="Buscar más proveedores en NAF…"
                className="h-8 text-xs"
              />
            </div>

            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar nº doc, físico, detalle…"
                className="pl-8"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1.5", isFetching && "animate-spin")} />
              Actualizar
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" />
              Excel
            </Button>
            {(tipoDocs.length > 0 ||
              documentoClase !== "ALL" ||
              noProve !== "ALL" ||
              search.trim() ||
              hasActiveColumnFilters(columnFilters)) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTipoDocs([]);
                  setDocumentoClase("ALL");
                  setNoProve("ALL");
                  setSearch("");
                  setColumnFilters(clearColumnFilters(columnFilterKeys));
                  setPage(1);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          {summary && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="tabular-nums">
                {summary.count.toLocaleString()} movimientos
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                Monto {formatCurrency(summary.monto)}
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                Saldo {formatCurrency(summary.saldo)}
              </Badge>
              {summary.anulados > 0 && (
                <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 border-transparent">
                  {summary.anulados} anulados
                </Badge>
              )}
              {summary.porTipo.slice(0, 8).map((t) => (
                <Badge
                  key={t.tipoDoc}
                  variant="secondary"
                  className="tabular-nums cursor-pointer"
                  onClick={() => {
                    setTipoDocs([t.tipoDoc]);
                    setPage(1);
                  }}
                  title={`Filtrar solo ${t.label}`}
                >
                  {t.tipoDoc}: {t.count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[min(70vh,720px)]">
            <table data-table-id="cxp-movimientos" className="w-full text-sm">
              <thead>
                <TableColumnFilterHead
                  tableId="cxp-movimientos"
                  columns={columnDefs}
                  rows={rows}
                  filters={columnFilters}
                  onFilterChange={onColumnFilterChange}
                />
              </thead>
              <tbody>
                {isLoading && !result ? (
                  <tr>
                    <td colSpan={COLSPAN} className="px-4 py-10 text-center text-slate-500">
                      Cargando movimientos NAF…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={COLSPAN} className="px-4 py-10 text-center text-red-600">
                      {(error as Error)?.message ?? "Error al cargar movimientos."}
                    </td>
                  </tr>
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={COLSPAN} className="px-4 py-10 text-center text-slate-500">
                      Sin movimientos para el rango y filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row) => {
                    const anulado = (row.anulado ?? "N").toUpperCase() === "S";
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-t border-slate-100 hover:bg-slate-50/80",
                          anulado && "opacity-60",
                        )}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.fecha)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.companyCode ?? row.noCia}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="font-medium" title={row.tipoDocLabel}>
                            {row.tipoDoc}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" title={row.documentoClaseLabel}>
                          {row.documentoClase ?? "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{row.noDocu}</td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                          {row.noFisico ?? "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" title={row.cedula ?? undefined}>
                          {row.proveedor}
                        </td>
                        <td className="px-3 py-2 max-w-[280px]" title={row.detalle ?? row.concepto ?? undefined}>
                          <span className="line-clamp-2">{row.detalle ?? row.concepto ?? "—"}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(row.monto)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(row.saldo)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.monedaLabel}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {anulado ? (
                            <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 border-transparent">
                              Sí
                            </Badge>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <p>
                Mostrando {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)} de {total.toLocaleString()}
                {displayedRows.length !== rows.length
                  ? ` (${displayedRows.length} tras filtro de columnas)`
                  : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="tabular-nums text-xs">
                  {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
