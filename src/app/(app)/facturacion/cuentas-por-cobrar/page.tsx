"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/client-session";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, Loader2, Mail, MinusCircle, RefreshCw, Settings2, Wallet, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate, calendarDateInputValue } from "@/lib/utils/format";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { companyDisplayName, FACTURA_BILLING_KIND_LABELS } from "@/lib/utils/constants";
import { useCompanies } from "@/lib/hooks/use-companies";
import { hasPermission } from "@/lib/permissions/check";
import { DueDateCell } from "@/components/facturacion/DueDateCell";
import { CxcAbonosDialog } from "@/components/facturacion/CxcAbonosDialog";
import { CxcRebajosDialog } from "@/components/facturacion/CxcRebajosDialog";
import { CxcQuickFullPayment } from "@/components/facturacion/CxcQuickFullPayment";
import {
  appendCxcFilters,
  CxcListFilters,
  EMPTY_CXC_FILTERS,
  type CxcSearchFilters,
} from "@/components/facturacion/FacturacionListFilters";
import type { DueDateUrgency } from "@/lib/utils/due-date-urgency";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";

type BillingContact = {
  name: string;
  jobTitle: string | null;
  phone: string;
  phone2: string | null;
  email: string;
};

export type CuentaPorCobrarRow = {
  id: string;
  contractId: string;
  facturaMensualId?: string | null;
  periodMonth: number;
  periodYear: number;
  clientNameCopied: string;
  companyCodeCopied: string;
  licitacionNo?: string;
  documentNumber?: string;
  invoiceNumber: string | null;
  isReajuste?: boolean;
  hasContract?: boolean;
  hasPartialPayment?: boolean;
  clientType?: "PUBLIC" | "PRIVATE" | null;
  subtotalCopied?: number | null;
  ivaPctCopied?: number;
  ivaAmount?: number | null;
  totalCalculated: number | null;
  appliesRetention?: boolean;
  retentionPct?: number;
  retentionAmount?: number | null;
  expectedIssueDate: string;
  closedAt: string | null;
  dueDate: string;
  daysUntilDue: number | null;
  dueDateUrgency: DueDateUrgency;
  status: "FACTURADO" | "COBRADO";
  paymentPending: boolean;
  paidAt: string | null;
  billingContact: BillingContact | null;
  collectionEmailCount: number;
  lastCollectionEmailAt: string | null;
  cxcObservations: string | null;
  cxcExpectedPaymentDate: string | null;
  invoiceReceivedAt: string | null;
  provisionalReceiptNumber?: string | null;
  netAmountExpected?: number | null;
  totalRebajos?: number;
  totalAbonos?: number;
  adjustedCollectible?: number | null;
  remainingBalance?: number | null;
  provisionalPaymentAmount?: number | null;
  abonos?: {
    id: string;
    receiptNumber: string | null;
    amount: number;
    paidAt: string | null;
    sortOrder: number;
  }[];
  rebajos?: {
    id: string;
    description: string;
    amount: number;
    sortOrder: number;
  }[];
};

const FILTER_LABELS = {
  pending: "Pendientes de cobro",
  collected: "Cobradas",
  all: "Todas",
} as const;

export default function CuentasPorCobrarPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<keyof typeof FILTER_LABELS>("pending");
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [searchFilters, setSearchFilters] = useState<CxcSearchFilters>(EMPTY_CXC_FILTERS);
  const [abonosRow, setAbonosRow] = useState<CuentaPorCobrarRow | null>(null);
  const [rebajosRow, setRebajosRow] = useState<CuentaPorCobrarRow | null>(null);
  const canEdit = hasPermission(session, "facturacion.cxc", "edit");
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<{ data: CuentaPorCobrarRow[] }>({
    queryKey: ["cuentas-por-cobrar", filter, companyFilter, searchFilters],
    queryFn: async () => {
      const params = new URLSearchParams({ filter });
      companyFilter.forEach((c) => params.append("company", c));
      appendCxcFilters(params, searchFilters);
      const r = await fetch(`/api/cuentas-por-cobrar?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar");
      return json;
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ id, received }: { id: string; received: boolean }) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${id}/pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al registrar pago");
      return json.data as CuentaPorCobrarRow;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      toast.success(vars.received ? "Pago registrado como recibido" : "Registrado: pago no recibido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emailMutation = useMutation({
    mutationFn: async ({
      id,
      type,
    }: {
      id: string;
      type: "collection" | "due_reminder";
    }) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${id}/enviar-correo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al enviar correo");
      return json.data as { sentTo: string; cc: string | null; type: "collection" | "due_reminder" };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      const label =
        data.type === "due_reminder" ? "Recordatorio por vencer enviado" : "Correo de cobro enviado";
      toast.success(
        data.cc ? `${label} a ${data.sentTo} (CC: ${data.cc})` : `${label} a ${data.sentTo}`
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const onColumnFilterChange = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const columnDefs = useMemo((): TableColumnFilterDef<CuentaPorCobrarRow>[] => {
    return [
      { key: "cliente", label: "Cliente", getValue: (r) => r.clientNameCopied },
      { key: "contacto", label: "Contacto facturación", getValue: (r) => r.billingContact?.name ?? "" },
      { key: "periodo", label: "Periodo", getValue: (r) => `${r.periodMonth}/${r.periodYear}` },
      {
        key: "tipo",
        label: "Tipo",
        getValue: (r) =>
          r.isReajuste ? FACTURA_BILLING_KIND_LABELS.reajuste : FACTURA_BILLING_KIND_LABELS.mensual,
      },
      {
        key: "iva",
        label: "% IVA",
        align: "right",
        getValue: (r) =>
          r.ivaAmount != null || (r.ivaPctCopied != null && r.ivaPctCopied > 0)
            ? `${(r.ivaPctCopied ?? 0).toFixed(2)}%`
            : "",
      },
      {
        key: "ivaMonto",
        label: "Monto IVA",
        align: "right",
        getValue: (r) => (r.ivaAmount != null ? String(r.ivaAmount) : ""),
      },
      { key: "total", label: "Total", align: "right", getValue: (r) => (r.totalCalculated != null ? String(r.totalCalculated) : "") },
      {
        key: "retencionPct",
        label: "% Retención",
        align: "right",
        getValue: (r) =>
          r.appliesRetention && r.retentionPct != null
            ? `${(r.retentionPct * 100).toFixed(2)}%`
            : "",
      },
      {
        key: "retencionMonto",
        label: "Monto retención",
        align: "right",
        getValue: (r) => (r.retentionAmount != null ? String(r.retentionAmount) : ""),
      },
      {
        key: "neto",
        label: "Neto esperado",
        align: "right",
        getValue: (r) => (r.netAmountExpected != null ? String(r.netAmountExpected) : ""),
      },
      {
        key: "abonoSaldo",
        label: "Abono / Saldo",
        getValue: (r) =>
          r.hasPartialPayment
            ? `${r.totalAbonos ?? r.provisionalPaymentAmount ?? ""} ${r.remainingBalance ?? ""}`
            : "",
      },
      { key: "nroFactura", label: "Nº factura", getValue: (r) => r.invoiceNumber ?? "" },
      { key: "nroDocumento", label: "Nº documento (Codisa)", getValue: (r) => r.documentNumber ?? "" },
      { key: "emision", label: "Emisión", getValue: (r) => formatDate(r.closedAt ?? r.expectedIssueDate) },
      { key: "vencimiento", label: "Vencimiento", getValue: (r) => r.dueDate },
      {
        key: "pagoEsperado",
        label: "Pago esperado",
        getValue: (r) => (r.cxcExpectedPaymentDate ? formatDate(r.cxcExpectedPaymentDate) : ""),
      },
      {
        key: "recibidoConforme",
        label: "Recibido conforme",
        getValue: (r) => (r.invoiceReceivedAt ? formatDate(r.invoiceReceivedAt) : ""),
      },
      {
        key: "reciboProvisional",
        label: "Recibo provisional",
        getValue: (r) => r.provisionalReceiptNumber ?? "",
      },
      { key: "correos", label: "Correos cobro", getValue: (r) => String(r.collectionEmailCount) },
      { key: "observaciones", label: "Observaciones", getValue: (r) => r.cxcObservations ?? "" },
      { key: "estado", label: "Estado cobro", getValue: (r) => (r.paymentPending ? "Pendiente" : "Cobrado") },
      { key: "actions", label: "", filterable: false, getValue: () => "" },
    ];
  }, []);

  const displayedRows = useMemo(
    () =>
      filterRowsByColumnFilters(
        rows,
        columnFilters,
        columnDefs.map((c) => ({ key: c.key, getValue: c.getValue, mode: c.mode, filterable: c.filterable }))
      ),
    [rows, columnDefs, columnFilters]
  );

  const numericTotals = useMemo(() => {
    let totalSum = 0;
    let totalCount = 0;
    let ivaAmountSum = 0;
    let retentionAmountSum = 0;
    let netAmountSum = 0;
    let abonosSum = 0;
    let saldoSum = 0;
    for (const row of displayedRows) {
      if (row.totalCalculated != null) {
        totalSum += row.totalCalculated;
        totalCount += 1;
      }
      ivaAmountSum += row.ivaAmount ?? 0;
      retentionAmountSum += row.retentionAmount ?? 0;
      netAmountSum += row.netAmountExpected ?? row.totalCalculated ?? 0;
      abonosSum += row.totalAbonos ?? row.provisionalPaymentAmount ?? 0;
      saldoSum +=
        row.remainingBalance ??
        (row.paymentPending ? row.adjustedCollectible ?? row.netAmountExpected ?? row.totalCalculated ?? 0 : 0);
    }
    return {
      totalSum,
      totalCount,
      ivaAmountSum,
      retentionAmountSum,
      netAmountSum,
      abonosSum,
      saldoSum,
    };
  }, [displayedRows]);

  function handleExport() {
    if (displayedRows.length === 0) return;
    exportRowsToExcel({
      filename: "cuentas_por_cobrar",
      sheetName: "CxC",
      rows: displayedRows.map((row) => ({
        Cliente: row.clientNameCopied,
        Licitación: row.licitacionNo ?? "",
        Periodo: `${row.periodMonth}/${row.periodYear}`,
        Tipo: row.isReajuste ? FACTURA_BILLING_KIND_LABELS.reajuste : FACTURA_BILLING_KIND_LABELS.mensual,
        "IVA %": row.ivaPctCopied ?? "",
        "Monto IVA": row.ivaAmount ?? "",
        Total: row.totalCalculated ?? "",
        "% Retención": row.appliesRetention && row.retentionPct != null ? row.retentionPct * 100 : "",
        "Monto retención": row.retentionAmount ?? "",
        "Neto esperado": row.netAmountExpected ?? "",
        Saldo: row.remainingBalance ?? "",
        Abono: row.totalAbonos ?? row.provisionalPaymentAmount ?? "",
        "Nº factura": row.invoiceNumber ?? "",
        "Nº documento (Codisa)": row.documentNumber ?? "",
        Emisión: formatDate(row.closedAt ?? row.expectedIssueDate),
        Vencimiento: formatDate(row.dueDate),
        "Pago esperado": row.cxcExpectedPaymentDate ? formatDate(row.cxcExpectedPaymentDate) : "",
        "Recibido conforme": row.invoiceReceivedAt ? formatDate(row.invoiceReceivedAt) : "",
        "Recibo provisional": row.provisionalReceiptNumber ?? "",
        Estado: row.paymentPending ? "Pendiente" : "Cobrado",
        Observaciones: row.cxcObservations ?? "",
      })),
      columnWidths: [28, 14, 10, 12, 12, 12, 12, 14, 12, 12, 12, 14, 16, 16, 12, 32],
    });
  }

  const columnFilterKeys = useMemo(() => columnDefs.filter((c) => c.filterable !== false).map((c) => c.key), [columnDefs]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Cuentas por cobrar</h2>
          <p className="text-sm text-slate-500 mt-1">
            Facturas emitidas pendientes de cobro. Envíe recordatorios al contacto de facturación o confirme el
            pago.
          </p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" className="gap-2 shrink-0" asChild>
            <Link href="/facturacion/configuracion">
              <Settings2 className="h-4 w-4" />
              Configuración de correo
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
          <Select value={filter} onValueChange={(v) => setFilter(v as keyof typeof FILTER_LABELS)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTER_LABELS) as (keyof typeof FILTER_LABELS)[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {FILTER_LABELS[key]}
                </SelectItem>
              ))}
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
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Actualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={displayedRows.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel ({displayedRows.length})
          </Button>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500 ml-auto">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-600" /> 7+ días
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> &lt; 7 días
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-600" /> Vencida
            </span>
          </div>
          </div>
          <CxcListFilters
            filters={searchFilters}
            onChange={setSearchFilters}
            onClear={() => setSearchFilters(EMPTY_CXC_FILTERS)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">Cargando cuentas por cobrar…</div>
          ) : isError ? (
            <div className="p-12 text-center text-red-600">
              {(error as Error)?.message ?? "Error al cargar."}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              {filter === "pending"
                ? "No hay facturas pendientes de cobro."
                : "No hay registros con este filtro."}
            </div>
          ) : (
            <>
              {hasActiveColumnFilters(columnFilters) && (
                <div className="flex justify-end px-3 py-1.5 border-b border-[#e0e0e0] bg-[#f4f4f4]">
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
              <table data-table-id="facturacion-cuentas-por-cobrar" className="w-full text-sm">
              <thead>
                <TableColumnFilterHead
                  tableId="facturacion-cuentas-por-cobrar"
                  columns={columnDefs}
                  rows={rows}
                  filters={columnFilters}
                  onFilterChange={onColumnFilterChange}
                  filterRowClassName="bg-slate-50"
                  defaultColumnWidths={{
                    cliente: 200,
                    contacto: 160,
                    periodo: 80,
                    tipo: 100,
                    iva: 70,
                    ivaMonto: 100,
                    total: 110,
                    retencionPct: 90,
                    retencionMonto: 110,
                    neto: 110,
                    abonoSaldo: 120,
                    nroFactura: 180,
                    nroDocumento: 120,
                    emision: 100,
                    vencimiento: 120,
                    pagoEsperado: 140,
                    recibidoConforme: 120,
                    reciboProvisional: 140,
                    correos: 90,
                    observaciones: 160,
                    estado: 120,
                    actions: 170,
                  }}
                />
              </thead>
              <tbody>
                {displayedRows.map((row) => {
                  const pending = row.paymentPending;
                  const mutating =
                    paymentMutation.isPending && paymentMutation.variables?.id === row.id;
                  const sendingEmail =
                    emailMutation.isPending && emailMutation.variables?.id === row.id;
                  const canSendEmail = pending && Boolean(row.billingContact?.email);
                  const isOverdue = row.daysUntilDue !== null && row.daysUntilDue <= 0;
                  const emailType: "collection" | "due_reminder" = isOverdue
                    ? "collection"
                    : "due_reminder";
                  return (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{row.clientNameCopied}</div>
                        {row.licitacionNo && row.contractId ? (
                          <Link
                            href={`/contracts/${row.contractId}`}
                            className="text-xs text-red-600 hover:underline"
                          >
                            {row.licitacionNo}
                          </Link>
                        ) : row.licitacionNo ? (
                          <span className="text-xs text-slate-500">{row.licitacionNo}</span>
                        ) : !row.hasContract ? (
                          <span className="text-xs text-amber-600">Sin contrato vinculado</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 max-w-52">
                        {row.billingContact ? (
                          <div className="text-sm">
                            <div className="font-medium text-slate-800">{row.billingContact.name}</div>
                            {row.billingContact.jobTitle && (
                              <div className="text-xs text-slate-500">{row.billingContact.jobTitle}</div>
                            )}
                            <div className="text-xs text-slate-600 mt-0.5">{row.billingContact.phone}</div>
                            <a
                              href={`mailto:${row.billingContact.email}`}
                              className="text-xs text-red-600 hover:underline"
                            >
                              {row.billingContact.email}
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Sin contacto de facturación en el contrato
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {row.periodMonth}/{row.periodYear}
                      </td>
                      <td className="px-4 py-3">
                        <CxcBillingKindField
                          documentoId={row.id}
                          isReajuste={row.isReajuste ?? false}
                          canEdit={canEdit && row.status !== "COBRADO" && Boolean(row.facturaMensualId)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {row.ivaAmount != null || (row.ivaPctCopied != null && row.ivaPctCopied > 0)
                          ? `${(row.ivaPctCopied ?? 0).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {row.ivaAmount != null ? formatCurrency(row.ivaAmount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {row.totalCalculated != null ? formatCurrency(row.totalCalculated) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {row.appliesRetention && row.retentionPct != null
                          ? `${(row.retentionPct * 100).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                        {row.retentionAmount != null ? formatCurrency(row.retentionAmount) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {row.netAmountExpected != null
                          ? formatCurrency(row.netAmountExpected)
                          : row.totalCalculated != null
                            ? formatCurrency(row.totalCalculated)
                            : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums min-w-[120px]">
                        {row.hasPartialPayment ? (
                          <div className="space-y-0.5">
                            <div className="text-xs text-green-700">
                              Abono: {formatCurrency(row.totalAbonos ?? row.provisionalPaymentAmount ?? 0)}
                            </div>
                            <div className="font-semibold text-amber-800">
                              Saldo: {formatCurrency(row.remainingBalance ?? 0)}
                            </div>
                          </div>
                        ) : row.totalAbonos != null && row.totalAbonos > 0 ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                            Abono total
                          </Badge>
                        ) : row.paymentPending ? (
                          <span className="font-medium text-amber-800">
                            {formatCurrency(row.remainingBalance ?? row.totalCalculated ?? 0)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap tabular-nums" title={row.invoiceNumber ?? undefined}>
                        {row.invoiceNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap" title={row.documentNumber ?? undefined}>
                        {row.documentNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {formatDate(row.closedAt ?? row.expectedIssueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <DueDateCell
                          dueDate={row.dueDate}
                          urgency={row.dueDateUrgency}
                          daysUntilDue={row.daysUntilDue ?? 0}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <CxcGestionField
                          facturaId={row.id}
                          totalCalculated={row.totalCalculated}
                          cxcExpectedPaymentDate={row.cxcExpectedPaymentDate}
                          invoiceReceivedAt={row.invoiceReceivedAt}
                          provisionalReceiptNumber={row.provisionalReceiptNumber ?? null}
                          provisionalPaymentAmount={row.provisionalPaymentAmount ?? null}
                          canEdit={canEdit}
                          showExpectedDate
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <CxcGestionField
                          facturaId={row.id}
                          totalCalculated={row.totalCalculated}
                          cxcExpectedPaymentDate={row.cxcExpectedPaymentDate}
                          invoiceReceivedAt={row.invoiceReceivedAt}
                          provisionalReceiptNumber={row.provisionalReceiptNumber ?? null}
                          provisionalPaymentAmount={row.provisionalPaymentAmount ?? null}
                          canEdit={canEdit}
                          showReceivedDate
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <CxcGestionField
                          facturaId={row.id}
                          totalCalculated={row.totalCalculated}
                          cxcExpectedPaymentDate={row.cxcExpectedPaymentDate}
                          invoiceReceivedAt={row.invoiceReceivedAt}
                          provisionalReceiptNumber={row.provisionalReceiptNumber ?? null}
                          provisionalPaymentAmount={row.provisionalPaymentAmount ?? null}
                          canEdit={canEdit}
                          showReceipt
                        />
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="font-semibold tabular-nums text-slate-800">
                          {row.collectionEmailCount}
                        </div>
                        {row.lastCollectionEmailAt && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            Último: {formatDate(row.lastCollectionEmailAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[200px] max-w-xs">
                        <CxcObservationsField
                          facturaId={row.id}
                          initialValue={row.cxcObservations}
                          canEdit={canEdit}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {pending ? (
                          <div className="space-y-1">
                            <Badge variant="secondary">Pendiente de pago</Badge>
                            {row.hasPartialPayment && (
                              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-200">
                                Pago parcial
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                              Pago recibido
                            </Badge>
                            {row.paidAt && (
                              <div className="text-xs text-slate-500">{formatDate(row.paidAt)}</div>
                            )}
                          </div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5 min-w-[160px]">
                            {pending && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 justify-start"
                                  onClick={() => setAbonosRow(row)}
                                >
                                  <Wallet className="h-3.5 w-3.5" />
                                  Abonos
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 justify-start"
                                  onClick={() => setRebajosRow(row)}
                                >
                                  <MinusCircle className="h-3.5 w-3.5" />
                                  Rebajos
                                </Button>
                                <CxcQuickFullPayment row={row} disabled={mutating || sendingEmail} />
                              </>
                            )}
                            {pending && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1 justify-start"
                                disabled={!canSendEmail || sendingEmail || mutating}
                                title={
                                  canSendEmail
                                    ? isOverdue
                                      ? "Enviar correo de cobro (factura vencida)"
                                      : "Enviar recordatorio de vencimiento próximo"
                                    : "Defina un contacto de facturación con correo en el contrato"
                                }
                                onClick={() => emailMutation.mutate({ id: row.id, type: emailType })}
                              >
                                {sendingEmail ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5" />
                                )}
                                {isOverdue ? "Correo de cobro" : "Recordatorio por vencer"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant={pending ? "default" : "outline"}
                              className="gap-1 justify-start"
                              disabled={mutating}
                              onClick={() => paymentMutation.mutate({ id: row.id, received: true })}
                            >
                              {mutating && paymentMutation.variables?.received ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Pago recibido
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1 justify-start text-amber-800 border-amber-200 hover:bg-amber-50"
                              disabled={mutating}
                              onClick={() => paymentMutation.mutate({ id: row.id, received: false })}
                            >
                              {mutating && !paymentMutation.variables?.received ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              No recibido
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <td colSpan={4} className="px-4 py-3">
                    Totales ({numericTotals.totalCount} con monto · {displayedRows.length}{" "}
                    {displayedRows.length === 1 ? "fila" : "filas"})
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">—</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {numericTotals.totalCount > 0
                      ? formatCurrency(numericTotals.ivaAmountSum)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {numericTotals.totalCount > 0
                      ? formatCurrency(numericTotals.totalSum)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">—</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {numericTotals.totalCount > 0
                      ? formatCurrency(numericTotals.retentionAmountSum)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {numericTotals.totalCount > 0
                      ? formatCurrency(numericTotals.netAmountSum)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div className="space-y-0.5">
                      <div className="text-xs text-green-700 font-semibold">
                        Abono: {formatCurrency(numericTotals.abonosSum)}
                      </div>
                      <div className="text-amber-800">
                        Saldo: {formatCurrency(numericTotals.saldoSum)}
                      </div>
                    </div>
                  </td>
                  <td colSpan={canEdit ? 11 : 10} className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
            </>
          )}
        </CardContent>
      </Card>

      {abonosRow && (
        <CxcAbonosDialog
          row={abonosRow}
          open={Boolean(abonosRow)}
          onOpenChange={(open) => !open && setAbonosRow(null)}
          canEdit={canEdit}
        />
      )}
      {rebajosRow && (
        <CxcRebajosDialog
          row={rebajosRow}
          open={Boolean(rebajosRow)}
          onOpenChange={(open) => !open && setRebajosRow(null)}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

function CxcGestionField({
  facturaId,
  totalCalculated,
  cxcExpectedPaymentDate,
  invoiceReceivedAt,
  provisionalReceiptNumber,
  provisionalPaymentAmount,
  canEdit,
  showExpectedDate,
  showReceivedDate,
  showReceipt,
}: {
  facturaId: string;
  totalCalculated: number | null;
  cxcExpectedPaymentDate: string | null;
  invoiceReceivedAt: string | null;
  provisionalReceiptNumber: string | null;
  provisionalPaymentAmount: number | null;
  canEdit: boolean;
  showExpectedDate?: boolean;
  showReceivedDate?: boolean;
  showReceipt?: boolean;
}) {
  const qc = useQueryClient();
  const [expectedDate, setExpectedDate] = useState(
    calendarDateInputValue(cxcExpectedPaymentDate ?? "")
  );
  const [receivedDate, setReceivedDate] = useState(
    calendarDateInputValue(invoiceReceivedAt ?? "")
  );
  const [receiptNumber, setReceiptNumber] = useState(provisionalReceiptNumber ?? "");
  const [paymentAmount, setPaymentAmount] = useState(
    provisionalPaymentAmount != null ? String(provisionalPaymentAmount) : ""
  );

  useEffect(() => {
    setExpectedDate(calendarDateInputValue(cxcExpectedPaymentDate ?? ""));
    setReceivedDate(calendarDateInputValue(invoiceReceivedAt ?? ""));
    setReceiptNumber(provisionalReceiptNumber ?? "");
    setPaymentAmount(provisionalPaymentAmount != null ? String(provisionalPaymentAmount) : "");
  }, [
    facturaId,
    cxcExpectedPaymentDate,
    invoiceReceivedAt,
    provisionalReceiptNumber,
    provisionalPaymentAmount,
  ]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      invoiceReceivedAt?: string | null;
      cxcExpectedPaymentDate?: string | null;
      provisionalReceiptNumber?: string | null;
      provisionalPaymentAmount?: number | null;
    }) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${facturaId}/gestion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json.data as CuentaPorCobrarRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      toast.success("Gestión de cobro guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const expectedDirty =
    expectedDate !== calendarDateInputValue(cxcExpectedPaymentDate ?? "");
  const receivedDirty =
    receivedDate !== calendarDateInputValue(invoiceReceivedAt ?? "");
  const receiptDirty =
    receiptNumber.trim() !== (provisionalReceiptNumber ?? "").trim() ||
    paymentAmount.trim() !==
      (provisionalPaymentAmount != null ? String(provisionalPaymentAmount) : "").trim();

  if (showReceipt) {
    if (!canEdit) {
      return (
        <div className="text-sm text-slate-600 space-y-0.5">
          <div>{provisionalReceiptNumber?.trim() ? provisionalReceiptNumber : "—"}</div>
          {provisionalPaymentAmount != null && provisionalPaymentAmount > 0 && (
            <div className="text-xs text-green-700">
              Abono: {formatCurrency(provisionalPaymentAmount)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1.5 min-w-[160px]">
        <input
          type="text"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="Nº recibo provisional"
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value)}
          disabled={saveMutation.isPending}
          maxLength={100}
        />
        <input
          type="number"
          min={0}
          step="0.01"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder={
            totalCalculated != null
              ? `Abono (máx. ${totalCalculated.toFixed(2)})`
              : "Monto del abono"
          }
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
          disabled={saveMutation.isPending}
        />
        {receiptDirty && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full"
            disabled={saveMutation.isPending}
            onClick={() => {
              const parsed = paymentAmount.trim() === "" ? null : Number.parseFloat(paymentAmount);
              if (parsed != null && Number.isNaN(parsed)) {
                toast.error("Monto de abono inválido");
                return;
              }
              saveMutation.mutate({
                provisionalReceiptNumber: receiptNumber.trim() || null,
                provisionalPaymentAmount: parsed,
              });
            }}
          >
            {saveMutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        )}
      </div>
    );
  }

  if (showReceivedDate) {
    if (!canEdit) {
      return (
        <span className="text-sm text-slate-600 whitespace-nowrap">
          {invoiceReceivedAt ? formatDate(invoiceReceivedAt) : "—"}
        </span>
      );
    }

    return (
      <div className="space-y-1.5 min-w-[130px]">
        <input
          type="date"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={receivedDate}
          onChange={(e) => setReceivedDate(e.target.value)}
          disabled={saveMutation.isPending}
          title="Fecha de recibido conforme de la factura"
        />
        {receivedDirty && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                invoiceReceivedAt: receivedDate || null,
              })
            }
          >
            {saveMutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        )}
      </div>
    );
  }

  if (showExpectedDate) {
    if (!canEdit) {
      return (
        <span className="text-sm text-slate-600 whitespace-nowrap">
          {cxcExpectedPaymentDate ? formatDate(cxcExpectedPaymentDate) : "—"}
        </span>
      );
    }

    return (
      <div className="space-y-1.5 min-w-[130px]">
        <input
          type="date"
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
          disabled={saveMutation.isPending}
        />
        {expectedDirty && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                cxcExpectedPaymentDate: expectedDate || null,
              })
            }
          >
            {saveMutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        )}
      </div>
    );
  }

  return null;
}

function CxcBillingKindField({
  documentoId,
  isReajuste,
  canEdit,
}: {
  documentoId: string;
  isReajuste: boolean;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (nextIsReajuste: boolean) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${documentoId}/gestion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReajuste: nextIsReajuste }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar tipo");
      return json.data as CuentaPorCobrarRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      toast.success("Tipo de factura actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canEdit) {
    return (
      <Badge variant={isReajuste ? "outline" : "secondary"} className={isReajuste ? "border-amber-300 text-amber-800" : ""}>
        {isReajuste ? FACTURA_BILLING_KIND_LABELS.reajuste : FACTURA_BILLING_KIND_LABELS.mensual}
      </Badge>
    );
  }

  return (
    <Select
      value={isReajuste ? "reajuste" : "mensual"}
      disabled={mutation.isPending}
      onValueChange={(value) => mutation.mutate(value === "reajuste")}
    >
      <SelectTrigger className="h-8 w-[160px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="mensual">{FACTURA_BILLING_KIND_LABELS.mensual}</SelectItem>
        <SelectItem value="reajuste">{FACTURA_BILLING_KIND_LABELS.reajuste}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function CxcObservationsField({
  facturaId,
  initialValue,
  canEdit,
}: {
  facturaId: string;
  initialValue: string | null;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(initialValue ?? "");

  useEffect(() => {
    setDraft(initialValue ?? "");
  }, [initialValue, facturaId]);

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${facturaId}/observaciones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cxcObservations: text.trim() || null }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json.data as CuentaPorCobrarRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      toast.success("Observaciones guardadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = draft.trim() !== (initialValue ?? "").trim();

  if (!canEdit) {
    return (
      <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">
        {initialValue?.trim() ? initialValue : "—"}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <textarea
        className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm min-h-[72px] resize-y"
        placeholder="Notas de gestión de cobro…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={saveMutation.isPending}
        maxLength={8000}
      />
      {dirty && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate(draft)}
        >
          {saveMutation.isPending ? "Guardando…" : "Guardar"}
        </Button>
      )}
    </div>
  );
}
