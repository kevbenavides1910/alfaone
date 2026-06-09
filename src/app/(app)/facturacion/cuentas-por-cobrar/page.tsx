"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, Loader2, Mail, RefreshCw, Settings2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate, calendarDateInputValue } from "@/lib/utils/format";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { hasPermission } from "@/lib/permissions/check";
import { DueDateCell } from "@/components/facturacion/DueDateCell";
import {
  appendCxcFilters,
  CxcListFilters,
  EMPTY_CXC_FILTERS,
  type CxcSearchFilters,
} from "@/components/facturacion/FacturacionListFilters";
import type { DueDateUrgency } from "@/lib/utils/due-date-urgency";

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
  periodMonth: number;
  periodYear: number;
  clientNameCopied: string;
  companyCodeCopied: string;
  licitacionNo?: string;
  documentNumber?: string;
  invoiceNumber: string | null;
  invoiceReceivedAt: string | null;
  totalCalculated: number | null;
  expectedIssueDate: string;
  closedAt: string | null;
  dueDate: string;
  daysUntilDue: number;
  dueDateUrgency: DueDateUrgency;
  status: "FACTURADO" | "COBRADO";
  paymentPending: boolean;
  paidAt: string | null;
  billingContact: BillingContact | null;
  collectionEmailCount: number;
  lastCollectionEmailAt: string | null;
  cxcObservations: string | null;
  cxcExpectedPaymentDate: string | null;
  provisionalReceiptNumber: string | null;
  provisionalPaymentAmount: number | null;
  remainingBalance: number | null;
  hasPartialPayment: boolean;
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
  const [searchFilters, setSearchFilters] = useState<CxcSearchFilters>(EMPTY_CXC_FILTERS);
  const canEdit = hasPermission(session, "facturacion.cxc", "edit");

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<{ data: CuentaPorCobrarRow[] }>({
    queryKey: ["cuentas-por-cobrar", filter, searchFilters],
    queryFn: async () => {
      const params = new URLSearchParams({ filter });
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

  function handleExport() {
    if (rows.length === 0) return;
    exportRowsToExcel({
      filename: "cuentas_por_cobrar",
      sheetName: "CxC",
      rows: rows.map((row) => ({
        Cliente: row.clientNameCopied,
        Licitación: row.licitacionNo ?? "",
        Periodo: `${row.periodMonth}/${row.periodYear}`,
        Total: row.totalCalculated ?? "",
        Saldo: row.remainingBalance ?? "",
        Abono: row.provisionalPaymentAmount ?? "",
        "Nº factura": row.invoiceNumber ?? "",
        "Nº documento": row.documentNumber ?? "",
        Emisión: formatDate(row.closedAt ?? row.expectedIssueDate),
        Vencimiento: formatDate(row.dueDate),
        "Pago esperado": row.cxcExpectedPaymentDate ? formatDate(row.cxcExpectedPaymentDate) : "",
        "Recibido conforme": row.invoiceReceivedAt ? formatDate(row.invoiceReceivedAt) : "",
        "Recibo provisional": row.provisionalReceiptNumber ?? "",
        Estado: row.paymentPending ? "Pendiente" : "Cobrado",
        Observaciones: row.cxcObservations ?? "",
      })),
      columnWidths: [28, 14, 10, 12, 12, 12, 14, 12, 12, 12, 14, 16, 16, 12, 32],
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Cuentas por cobrar</h2>
          <p className="text-sm text-slate-500 mt-1">
            Documentos de cobro importados desde SAP (FC/FM). Envíe recordatorios al contacto de facturación o
            confirme el pago.
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
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Actualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExport}
            disabled={rows.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel ({rows.length})
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Contacto facturación</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Periodo</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Abono / Saldo</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Nº factura</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Emisión</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Vencimiento</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[140px]">
                    Pago esperado
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[140px]">
                    Recibido conforme
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[180px]">
                    Recibo provisional
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Correos cobro</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 min-w-[200px]">
                    Observaciones
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Estado cobro</th>
                  {canEdit && <th className="px-4 py-3 font-semibold text-slate-600">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
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
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {row.licitacionNo}
                          </Link>
                        ) : (
                          <span className="text-xs text-amber-600">Sin contrato vinculado</span>
                        )}
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
                              className="text-xs text-blue-600 hover:underline"
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
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {row.totalCalculated != null ? formatCurrency(row.totalCalculated) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums min-w-[120px]">
                        {row.hasPartialPayment ? (
                          <div className="space-y-0.5">
                            <div className="text-xs text-green-700">
                              Abono: {formatCurrency(row.provisionalPaymentAmount!)}
                            </div>
                            <div className="font-semibold text-amber-800">
                              Saldo: {formatCurrency(row.remainingBalance!)}
                            </div>
                          </div>
                        ) : row.provisionalPaymentAmount != null && row.provisionalPaymentAmount > 0 ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                            Abono total
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.invoiceNumber ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {formatDate(row.closedAt ?? row.expectedIssueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <DueDateCell
                          dueDate={row.dueDate}
                          urgency={row.dueDateUrgency}
                          daysUntilDue={row.daysUntilDue}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <CxcGestionField
                          facturaId={row.id}
                          totalCalculated={row.totalCalculated}
                          cxcExpectedPaymentDate={row.cxcExpectedPaymentDate}
                          invoiceReceivedAt={row.invoiceReceivedAt}
                          provisionalReceiptNumber={row.provisionalReceiptNumber}
                          provisionalPaymentAmount={row.provisionalPaymentAmount}
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
                          provisionalReceiptNumber={row.provisionalReceiptNumber}
                          provisionalPaymentAmount={row.provisionalPaymentAmount}
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
                          provisionalReceiptNumber={row.provisionalReceiptNumber}
                          provisionalPaymentAmount={row.provisionalPaymentAmount}
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
                              <Badge
                                variant="outline"
                                className="border-amber-300 text-amber-800 bg-amber-50"
                              >
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
                          <div className="flex flex-col gap-1.5 min-w-[140px]">
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
            </table>
          )}
        </CardContent>
      </Card>
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

  return null;
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
