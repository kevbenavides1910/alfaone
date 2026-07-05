"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CalendarDays, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { FACTURA_MENSUAL_STATUS_LABELS, HIRING_TYPE_LABELS } from "@/lib/utils/constants";
import { hasPermission } from "@/lib/permissions/check";
import {
  FacturacionDetailDialog,
  type FacturaMensualRow,
} from "@/components/facturacion/FacturacionDetailDialog";
import { FacturaTimelinessBadge } from "@/components/facturacion/FacturaTimelinessBadge";

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

export default function FacturacionPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<FacturaMensualRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const canEdit = hasPermission(session, "facturacion.cobro", "edit");

  const yearOptions = useMemo(() => {
    const y = currentYear();
    return [y - 1, y, y + 1];
  }, []);

  const queryKey = ["facturacion", periodMonth, periodYear, statusFilter];

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery<{ data: FacturaMensualRow[] }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        periodMonth: String(periodMonth),
        periodYear: String(periodYear),
      });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const r = await fetch(`/api/facturacion?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar facturación");
      return json;
    },
  });

  const rows = data?.data ?? [];

  const selectedFresh = selected
    ? rows.find((r) => r.id === selected.id) ?? selected
    : null;

  function openDetail(row: FacturaMensualRow) {
    setSelected(row);
    setDetailOpen(true);
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
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Cliente</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Contratación</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Subtotal</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">% IVA</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Fecha esperada</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Cierre</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Últ. act. precio</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer"
                      onClick={() => openDetail(row)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{row.clientNameCopied}</div>
                        {row.licitacionNo && (
                          <div className="text-xs text-slate-400">{row.licitacionNo}</div>
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
                        {row.ivaPctCopied.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {row.amountDefined && row.totalCalculated != null
                          ? formatCurrency(row.totalCalculated)
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
              </table>
            )}
          </CardContent>
        </Card>

      <FacturacionDetailDialog
        factura={selectedFresh}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelected(null);
        }}
        canEdit={canEdit}
      />
    </div>
  );
}
