"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail, RefreshCw, Settings2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { hasPermission } from "@/lib/permissions/check";
import { DueDateCell } from "@/components/facturacion/DueDateCell";
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
  invoiceNumber: string | null;
  totalCalculated: number | null;
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
  const canEdit = hasPermission(session, "facturacion.cxc", "edit");

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<{ data: CuentaPorCobrarRow[] }>({
    queryKey: ["cuentas-por-cobrar", filter],
    queryFn: async () => {
      const r = await fetch(`/api/cuentas-por-cobrar?filter=${filter}`);
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
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
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
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Nº factura</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Emisión</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Vencimiento</th>
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
                        {row.licitacionNo && (
                          <Link
                            href={`/contracts/${row.contractId}`}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {row.licitacionNo}
                          </Link>
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
                      <td className="px-4 py-3 text-slate-600">{row.invoiceNumber ?? "—"}</td>
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
                          <Badge variant="secondary">Pendiente de pago</Badge>
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
