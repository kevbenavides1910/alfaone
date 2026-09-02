"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableColumnFilterHead, hasActiveColumnFilters, clearColumnFilters, type TableColumnFilterDef } from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { useSession } from "@/lib/auth/client-session";
import Link from "next/link";
import { CalendarDays, FileSpreadsheet, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import {
  companyDisplayName,
  FACTURA_MENSUAL_STATUS_LABELS,
  HIRING_TYPE_LABELS,
} from "@/lib/utils/constants";
import { useCompanies } from "@/lib/hooks/use-companies";
import { hasPermission } from "@/lib/permissions/check";
import {
  FacturacionDetailDialog,
  type FacturaMensualRow,
} from "@/components/facturacion/FacturacionDetailDialog";
import {
  appendFacturacionFilters,
  EMPTY_FACTURACION_FILTERS,
  expandFacturasForList,
  FacturacionListFilters,
  filterFacturacionRows,
  type FacturaListExpandedRow,
  type FacturacionSearchFilters,
} from "@/components/facturacion/FacturacionListFilters";
import { FacturaTimelinessBadge } from "@/components/facturacion/FacturaTimelinessBadge";
import { getFacturaIvaAmount } from "@/components/facturacion/facturacion-amount-change";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const STATUS_VARIANT: Record<
  keyof typeof FACTURA_MENSUAL_STATUS_LABELS,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDIENTE_DEFINIR: "outline",
  PENDIENTE: "secondary",
  EN_PROCESO: "outline",
  FACTURADO: "default",
  COBRADO: "default",
};

function currentYear() {
  return new Date().getFullYear();
}

function effectiveIvaPct(row: Parameters<typeof getFacturaIvaAmount>[0]): number {
  const iva = getFacturaIvaAmount(row);
  const sub = row.subtotalCopied;
  if (iva != null && sub != null && sub > 0) {
    return Math.round((iva / sub) * 10000) / 100;
  }
  const pct = Number(row.ivaPctCopied);
  return Number.isFinite(pct) ? pct : 0;
}

export default function FacturacionPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [searchFilters, setSearchFilters] = useState<FacturacionSearchFilters>(EMPTY_FACTURACION_FILTERS);
  const [selected, setSelected] = useState<FacturaMensualRow | null>(null);
  const [selectedEmisionId, setSelectedEmisionId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const queryClient = useQueryClient();
  const canEdit = hasPermission(session, "facturacion.cobro", "edit");
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];

  const yearOptions = useMemo(() => {
    const y = currentYear();
    return [y - 1, y, y + 1];
  }, []);


  const lastSyncedPeriod = useRef<string | null>(null);

  useEffect(() => {
    const periodKey = `${periodYear}-${periodMonth}`;
    if (lastSyncedPeriod.current === periodKey) return;
    lastSyncedPeriod.current = periodKey;

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/facturacion/sync-period", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodMonth, periodYear }),
        });
        const json = await r.json();
        if (cancelled || json.error) return;
        await queryClient.invalidateQueries({
          queryKey: ["facturacion", periodMonth, periodYear],
        });
      } catch {
        /* sync en background; la lista ya cargó sin bloquear */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [periodMonth, periodYear, queryClient]);

  const queryKey = ["facturacion", periodMonth, periodYear, statusFilter, companyFilter, searchFilters];

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<{ data: FacturaMensualRow[] }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        periodMonth: String(periodMonth),
        periodYear: String(periodYear),
      });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      companyFilter.forEach((c) => params.append("company", c));
      appendFacturacionFilters(params, searchFilters);
      const r = await fetch(`/api/facturacion?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar facturación");
      return json;
    },
  });

  const rows = data?.data ?? [];
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const expandedListRows = useMemo((): FacturaListExpandedRow[] => {
    return expandFacturasForList(rows).map((row) => {
      const em = row.emisionId
        ? row.emisiones?.find((e) => e.id === row.emisionId)
        : null;
      if (em) {
        const subtotalCopied =
          em.subtotalCopied ?? (row.emisionTotal > 1 ? null : row.subtotalCopied);
        const totalCalculated =
          em.totalCalculated ?? (row.emisionTotal > 1 ? null : row.totalCalculated);
        let contractVentaSubtotal = em.contractVentaSubtotal ?? null;
        let contractVentaTotal = em.contractVentaTotal ?? null;
        let ventaFacturadoDelta = em.ventaFacturadoDelta ?? null;
        if (contractVentaSubtotal == null && row.contractVentaSubtotal != null) {
          contractVentaSubtotal =
            row.emisionTotal > 1
              ? row.contractVentaSubtotal / row.emisionTotal
              : row.contractVentaSubtotal;
        }
        if (contractVentaTotal == null && row.contractVentaTotal != null) {
          contractVentaTotal =
            row.emisionTotal > 1
              ? row.contractVentaTotal / row.emisionTotal
              : row.contractVentaTotal;
        }
        if (ventaFacturadoDelta == null && subtotalCopied != null && contractVentaSubtotal != null) {
          ventaFacturadoDelta = subtotalCopied - contractVentaSubtotal;
        }
        return {
          ...row,
          subtotalCopied,
          totalCalculated,
          contractVentaSubtotal,
          contractVentaTotal,
          ventaFacturadoDelta,
        };
      }
      if (!row.amountDefined || row.emisionTotal <= 1) return row;
      const share = 1 / row.emisionTotal;
      const subtotalCopied = row.subtotalCopied != null ? row.subtotalCopied * share : null;
      const contractVentaSubtotal =
        row.contractVentaSubtotal != null ? row.contractVentaSubtotal * share : null;
      const ventaFacturadoDelta =
        subtotalCopied != null && contractVentaSubtotal != null
          ? subtotalCopied - contractVentaSubtotal
          : row.ventaFacturadoDelta != null
            ? row.ventaFacturadoDelta * share
            : null;
      return {
        ...row,
        subtotalCopied,
        totalCalculated: row.totalCalculated != null ? row.totalCalculated * share : null,
        contractVentaSubtotal,
        contractVentaTotal: row.contractVentaTotal != null ? row.contractVentaTotal * share : null,
        ventaFacturadoDelta,
      };
    });
  }, [rows]);

  const facturaColumnDefs = useMemo((): TableColumnFilterDef<FacturaListExpandedRow>[] => [
    { key: "cliente", label: "Cliente", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => `${r.clientNameCopied} ${r.licitacionNo ?? ""}`.trim() },
    { key: "administracion", label: "Administración", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => r.administrationName ?? "" },
    { key: "contratacion", label: "Contratación", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => HIRING_TYPE_LABELS[r.hiringTypeCopied ?? "FIXED"] },
    { key: "subtotal", label: "Subtotal", align: "right", headerClassName: "text-right px-4 py-3 font-semibold text-slate-600", getValue: (r) => r.amountDefined && r.subtotalCopied != null ? formatCurrency(r.subtotalCopied) : "—" },
    { key: "iva", label: "% IVA", align: "right", headerClassName: "text-right px-4 py-3 font-semibold text-slate-600", getValue: (r) => `${effectiveIvaPct(r).toFixed(2)}%` },
    { key: "ivaMonto", label: "Monto IVA", align: "right", headerClassName: "text-right px-4 py-3 font-semibold text-slate-600", getValue: (r) => {
      const iva = getFacturaIvaAmount(r);
      return r.amountDefined && iva != null ? formatCurrency(iva) : "—";
    } },
    { key: "total", label: "Total", align: "right", headerClassName: "text-right px-4 py-3 font-semibold text-slate-600", getValue: (r) => r.amountDefined && r.totalCalculated != null ? formatCurrency(r.totalCalculated) : "—" },
    { key: "ventaContrato", label: "Venta contrato", align: "right", headerClassName: "text-right px-4 py-3 font-semibold text-slate-600", getValue: (r) => r.contractVentaSubtotal != null ? formatCurrency(r.contractVentaSubtotal) : "—" },
    { key: "diferenciaVenta", label: "Diferencia", align: "right", headerClassName: "text-right px-4 py-3 font-semibold text-slate-600", getValue: (r) => r.ventaFacturadoDelta != null ? formatCurrency(r.ventaFacturadoDelta) : "—" },
    { key: "fechaEsperada", label: "Fecha esperada", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => formatDate(r.expectedIssueDate) },
    { key: "cierre", label: "Cierre", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => r.closedAt ? formatDate(r.closedAt) : "" },
    { key: "recibidoConforme", label: "Recibido conforme", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => r.invoiceReceivedAt ? formatDate(r.invoiceReceivedAt) : "" },
    { key: "ultPrecio", label: "Últ. act. precio", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => formatDate(r.lastPriceUpdateCopied) },
    { key: "estado", label: "Estado", headerClassName: "text-left px-4 py-3 font-semibold text-slate-600", getValue: (r) => FACTURA_MENSUAL_STATUS_LABELS[r.status] },
    { key: "actions", label: "", filterable: false, headerClassName: "px-4 py-3", getValue: () => "" },
  ], []);

  const searchedRows = useMemo(
    () => filterFacturacionRows(expandedListRows, searchFilters),
    [expandedListRows, searchFilters]
  );

  const displayedRows = useMemo(
    () => filterRowsByColumnFilters(searchedRows, columnFilters, facturaColumnDefs),
    [searchedRows, columnFilters, facturaColumnDefs]
  );

  const numericTotals = useMemo(() => {
    const withAmount = displayedRows.filter(
      (r) => r.amountDefined && r.subtotalCopied != null && r.totalCalculated != null
    );
    const subtotalSum = withAmount.reduce((s, r) => s + (r.subtotalCopied ?? 0), 0);
    const totalSum = withAmount.reduce((s, r) => s + (r.totalCalculated ?? 0), 0);
    const contractVentaSum = withAmount.every((r) => r.contractVentaSubtotal != null)
      ? withAmount.reduce((s, r) => s + (r.contractVentaSubtotal ?? 0), 0)
      : null;
    const deltaSum = withAmount.every((r) => r.ventaFacturadoDelta != null)
      ? withAmount.reduce((s, r) => s + (r.ventaFacturadoDelta ?? 0), 0)
      : null;
    const ivaAmountSum = withAmount.reduce((s, r) => s + (getFacturaIvaAmount(r) ?? 0), 0);
    const weightedIvaPct =
      subtotalSum > 0
        ? withAmount.reduce((s, r) => s + (r.subtotalCopied ?? 0) * effectiveIvaPct(r), 0) / subtotalSum
        : null;
    return { subtotalSum, totalSum, contractVentaSum, deltaSum, weightedIvaPct, ivaAmountSum, withAmountCount: withAmount.length };
  }, [displayedRows]);

  const columnFilterKeys = useMemo(
    () => facturaColumnDefs.filter((c) => c.filterable !== false).map((c) => c.key),
    [facturaColumnDefs]
  );

  const selectedFresh = selected
    ? rows.find((r) => r.id === selected.id) ?? selected
    : null;

  function openDetail(row: FacturaListExpandedRow) {
    const factura = rows.find((r) => r.id === row.id) ?? row;
    setSelected(factura);
    setSelectedEmisionId(row.emisionId ?? null);
    setDetailOpen(true);
  }

  function handleExport() {
    if (displayedRows.length === 0) return;
    exportRowsToExcel({
      filename: `facturacion_${monthLabel}_${periodYear}`,
      sheetName: "Facturación",
      rows: displayedRows.map((row) => ({
        Cliente: row.clientNameCopied,
        Licitación: row.licitacionNo ?? "",
        Administración: row.administrationName ?? "",
        Contratación: HIRING_TYPE_LABELS[row.hiringTypeCopied ?? "FIXED"],
        Subtotal: row.subtotalCopied ?? "",
        "IVA %": effectiveIvaPct(row),
        "Monto IVA": getFacturaIvaAmount(row) ?? "",
        Total: row.totalCalculated ?? "",
        "Venta contrato": row.contractVentaSubtotal ?? "",
        Diferencia: row.ventaFacturadoDelta ?? "",
        "Fecha esperada": formatDate(row.expectedIssueDate),
        "Fecha emisión/cierre": row.closedAt ? formatDate(row.closedAt) : "",
        "Recibido conforme": row.invoiceReceivedAt ? formatDate(row.invoiceReceivedAt) : "",
        "Últ. act. precio": formatDate(row.lastPriceUpdateCopied),
        Estado: FACTURA_MENSUAL_STATUS_LABELS[row.status],
      })),
      columnWidths: [28, 16, 18, 14, 8, 12, 12, 14, 14, 16, 14, 14],
    });
  }

  const monthLabel = MONTHS.find((m) => m.value === periodMonth)?.label ?? "";

  return (
    <div className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Facturación mensual</h2>
          <p className="text-sm text-slate-500 mt-1">
            Los contratos de contratación fija se cargan automáticamente con el último monto de venta del
            contrato. Los contratos por demanda aparecen pendientes hasta definir el monto en el contrato.
          </p>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <Select
              value={String(periodMonth)}
              onValueChange={(v) => setPeriodMonth(parseInt(v, 10))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(periodYear)}
              onValueChange={(v) => setPeriodYear(parseInt(v, 10))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                {(Object.keys(FACTURA_MENSUAL_STATUS_LABELS) as (keyof typeof FACTURA_MENSUAL_STATUS_LABELS)[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {FACTURA_MENSUAL_STATUS_LABELS[key]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <MultiSelect
              options={companyRows
                .filter((c) => c.isActive)
                .map((c) => ({
                  value: c.code,
                  label: companyDisplayName(c.code, companyRows),
                }))}
              value={companyFilter}
              onChange={setCompanyFilter}
              placeholder="Todas las empresas"
              className="w-[240px]"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 ml-auto"
              onClick={handleExport}
              disabled={displayedRows.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel ({displayedRows.length})
            </Button>
            </div>
            <FacturacionListFilters
              filters={searchFilters}
              onChange={setSearchFilters}
              onClear={() => setSearchFilters(EMPTY_FACTURACION_FILTERS)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">Cargando facturación...</div>
            ) : isError ? (
              <div className="p-12 text-center text-red-600">
                {(error as Error)?.message ?? "Error al cargar facturación."}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                No hay contratos activos en vigencia para {monthLabel} {periodYear}.
              </div>
            ) : (
              <>
                {hasActiveColumnFilters(columnFilters) && (
                  <div className="flex justify-end px-3 py-1.5 border-b bg-muted/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setColumnFilters(clearColumnFilters(columnFilterKeys))}
                    >
                      <X className="h-3 w-3" />
                      Limpiar filtros de columnas
                    </Button>
                  </div>
                )}
              <table data-table-id="facturacion-listado" className="w-full text-sm">
                <thead>
                  <TableColumnFilterHead
                    tableId="facturacion-listado"
                    columns={facturaColumnDefs}
                    rows={searchedRows}
                    filters={columnFilters}
                    onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                    headerRowClassName="border-b border-border bg-muted/50"
                    filterRowClassName="border-b border-border bg-muted/40"
                    defaultColumnWidths={{
                      cliente: 200,
                      administracion: 150,
                      contratacion: 110,
                      subtotal: 110,
                      iva: 70,
                      ivaMonto: 110,
                      total: 110,
                      ventaContrato: 110,
                      diferenciaVenta: 100,
                      fechaEsperada: 110,
                      cierre: 100,
                      recibidoConforme: 120,
                      ultPrecio: 110,
                      estado: 110,
                      actions: 80,
                    }}
                  />
                </thead>
                <tbody>
                  {displayedRows.map((row) => (
                    <tr
                      key={row.listKey}
                      className="border-b border-border hover:bg-muted/60 cursor-pointer"
                      onClick={() => openDetail(row)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{row.clientNameCopied}</div>
                        {row.licitacionNo && (
                          <div className="text-xs text-slate-400">{row.licitacionNo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {row.administrationName ?? (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </div>
                        {row.zoneName && (
                          <div className="text-xs text-slate-400">{row.zoneName}</div>
                        )}
                        {row.emisionTotal > 1 && (
                          <div className="text-xs text-slate-400">
                            Factura {row.emisionIndex + 1} de {row.emisionTotal}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.hiringTypeCopied === "FIXED" ? "secondary" : "outline"}>
                          {HIRING_TYPE_LABELS[row.hiringTypeCopied ?? "FIXED"]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.amountDefined && row.subtotalCopied != null
                          ? formatCurrency(row.subtotalCopied)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {effectiveIvaPct(row).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(() => {
                          const iva = getFacturaIvaAmount(row);
                          return row.amountDefined && iva != null ? formatCurrency(iva) : "—";
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {row.amountDefined && row.totalCalculated != null
                          ? formatCurrency(row.totalCalculated)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {row.contractVentaSubtotal != null
                          ? formatCurrency(row.contractVentaSubtotal)
                          : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums font-medium",
                          row.ventaFacturadoDelta != null && Math.abs(row.ventaFacturadoDelta) >= 0.01
                            ? row.ventaFacturadoDelta > 0
                              ? "text-red-600"
                              : "text-amber-700"
                            : "text-slate-600"
                        )}
                      >
                        {row.ventaFacturadoDelta != null
                          ? formatCurrency(row.ventaFacturadoDelta)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">{formatDate(row.expectedIssueDate)}</td>
                      <td className="px-4 py-3">
                        {row.closedAt ? (
                          <div className="space-y-1">
                            <div className="text-slate-800">{formatDate(row.closedAt)}</div>
                            {row.closedOnTime != null && row.closeDaysLate != null && (
                              <FacturaTimelinessBadge
                                closedOnTime={row.closedOnTime}
                                closeDaysLate={row.closeDaysLate}
                                compact
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.invoiceReceivedAt ? (
                          formatDate(row.invoiceReceivedAt)
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatDate(row.lastPriceUpdateCopied)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {FACTURA_MENSUAL_STATUS_LABELS[row.status]}
                        </Badge>
                        {row.status === "PENDIENTE_DEFINIR" && (
                          <div className="text-xs text-amber-700 mt-1">
                            <Link
                              href={`/contracts/${row.contractId}`}
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Definir en contrato →
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openDetail(row)}>
                          Detalle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/50 font-semibold text-foreground">
                    <td colSpan={3} className="px-4 py-3">
                      Totales ({numericTotals.withAmountCount} con monto · {displayedRows.length}{" "}
                      {displayedRows.length === 1 ? "fila" : "filas"})
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {numericTotals.withAmountCount > 0
                        ? formatCurrency(numericTotals.subtotalSum)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {numericTotals.weightedIvaPct != null
                        ? `${numericTotals.weightedIvaPct.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {numericTotals.withAmountCount > 0
                        ? formatCurrency(numericTotals.ivaAmountSum)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {numericTotals.withAmountCount > 0
                        ? formatCurrency(numericTotals.totalSum)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {numericTotals.contractVentaSum != null
                        ? formatCurrency(numericTotals.contractVentaSum)
                        : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums",
                        numericTotals.deltaSum != null && Math.abs(numericTotals.deltaSum) >= 0.01
                          ? numericTotals.deltaSum > 0
                            ? "text-red-600"
                            : "text-amber-700"
                          : ""
                      )}
                    >
                      {numericTotals.deltaSum != null
                        ? formatCurrency(numericTotals.deltaSum)
                        : "—"}
                    </td>
                    <td colSpan={6} className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
              </>
            )}
          </CardContent>
        </Card>

      <FacturacionDetailDialog
        factura={selectedFresh}
        focusedEmisionId={selectedEmisionId}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelected(null);
            setSelectedEmisionId(null);
          }
        }}
        canEdit={canEdit}
      />
    </div>
  );
}
