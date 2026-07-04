"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  Banknote,
  FileCheck2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/format";
import { hasPermission } from "@/lib/permissions/check";
import type {
  FacturacionDashboardData,
  CxcRollingBalanceData,
} from "@/modules/presupuestos/services/facturacion-dashboard";
import { cn } from "@/lib/utils/cn";

type DashboardResponse = {
  data: FacturacionDashboardData & {
    cxcRollingBalance: CxcRollingBalanceData;
    permissions: { facturacion: boolean; cxc: boolean };
  };
};

function pct(value: number | null) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function StatCard({
  label,
  amount,
  count,
  countLabel = "facturas",
  sub,
  accent,
}: {
  label: string;
  amount?: string;
  count?: number;
  countLabel?: string;
  sub?: string;
  accent?: "green" | "amber" | "blue" | "red";
}) {
  const accentClass =
    accent === "green"
      ? "text-green-700"
      : accent === "amber"
        ? "text-amber-700"
        : accent === "red"
          ? "text-red-700"
          : "text-blue-700";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      {amount != null && (
        <p className={cn("text-2xl font-bold tabular-nums mt-1", accentClass)}>{amount}</p>
      )}
      {count != null && (
        <p className={cn("text-sm font-semibold tabular-nums mt-0.5", amount != null ? "text-slate-700" : accentClass)}>
          {count} {countLabel}
        </p>
      )}
      {sub && <p className="text-xs text-slate-500 mt-1.5">{sub}</p>}
    </div>
  );
}

function SectionTable({
  title,
  description,
  headers,
  rows,
  totalRow,
}: {
  title: string;
  description: string;
  headers: string[];
  rows: (string | number)[][];
  totalRow?: (string | number)[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <p className="text-sm text-slate-500 font-normal">{description}</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50">
                {headers.map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap",
                      h === "Mes" ? "text-left" : "text-right"
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-4 py-2.5 tabular-nums",
                        j === 0 ? "text-left font-medium text-slate-800" : "text-right text-slate-700"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {totalRow && (
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  {totalRow.map((cell, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-4 py-2.5 tabular-nums",
                        j === 0 ? "text-left text-slate-900" : "text-right text-slate-800"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FacturacionDashboardPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const canDashboard = hasPermission(session, "facturacion.dashboard", "view");
  const canCobro = hasPermission(session, "facturacion.cobro", "view");
  const canCxc = hasPermission(session, "facturacion.cxc", "view");

  const yearOptions = useMemo(
    () => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1],
    [now]
  );

  const { data, isLoading, isFetching, refetch, isError, error } = useQuery<DashboardResponse>({
    queryKey: ["facturacion-dashboard", year],
    queryFn: async () => {
      const r = await fetch(`/api/facturacion/dashboard?year=${year}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar dashboard");
      return json;
    },
    enabled: canDashboard,
  });

  const dash = data?.data;
  const totals = dash?.totals;
  const snapshot = dash?.snapshot;

  const cxcRows =
    dash?.months.map((m) => [
      m.label,
      formatCurrency(m.cxc.dueAmount),
      m.cxc.dueCount,
      formatCurrency(m.cxc.collectedOnTimeAmount),
      m.cxc.collectedOnTimeCount,
      formatCurrency(m.cxc.collectedLateAmount),
      m.cxc.collectedLateCount,
      formatCurrency(m.cxc.pendingAmount),
      m.cxc.pendingCount,
      pct(m.cxc.onTimeRate),
      pct(m.cxc.onTimeRateByCount),
    ]) ?? [];

  const cxcTotalRow = totals
    ? [
        "Total año",
        formatCurrency(totals.cxc.dueAmount),
        totals.cxc.dueCount,
        formatCurrency(totals.cxc.collectedOnTimeAmount),
        totals.cxc.collectedOnTimeCount,
        formatCurrency(totals.cxc.collectedLateAmount),
        totals.cxc.collectedLateCount,
        formatCurrency(totals.cxc.pendingAmount),
        totals.cxc.pendingCount,
        pct(totals.cxc.onTimeRate),
        pct(totals.cxc.onTimeRateByCount),
      ]
    : undefined;

  const facturacionRows =
    dash?.months.map((m) => [
      m.label,
      formatCurrency(m.facturacion.expectedAmount),
      m.facturacion.expectedCount,
      formatCurrency(m.facturacion.invoicedAmount),
      m.facturacion.invoicedCount,
      formatCurrency(m.facturacion.invoicedOnTimeAmount),
      m.facturacion.invoicedOnTimeCount,
      formatCurrency(m.facturacion.receivedConformeAmount),
      m.facturacion.receivedConformeCount,
      formatCurrency(m.facturacion.pendingInvoiceAmount),
      m.facturacion.pendingInvoiceCount,
      pct(m.facturacion.receivedConformeRate),
      pct(m.facturacion.receivedConformeRateByCount),
      pct(m.facturacion.invoicedOnTimeRate),
      pct(m.facturacion.invoicedOnTimeRateByCount),
    ]) ?? [];

  const facturacionTotalRow = totals
    ? [
        "Total año",
        formatCurrency(totals.facturacion.expectedAmount),
        totals.facturacion.expectedCount,
        formatCurrency(totals.facturacion.invoicedAmount),
        totals.facturacion.invoicedCount,
        formatCurrency(totals.facturacion.invoicedOnTimeAmount),
        totals.facturacion.invoicedOnTimeCount,
        formatCurrency(totals.facturacion.receivedConformeAmount),
        totals.facturacion.receivedConformeCount,
        formatCurrency(totals.facturacion.pendingInvoiceAmount),
        totals.facturacion.pendingInvoiceCount,
        pct(totals.facturacion.receivedConformeRate),
        pct(totals.facturacion.receivedConformeRateByCount),
        pct(totals.facturacion.invoicedOnTimeRate),
        pct(totals.facturacion.invoicedOnTimeRateByCount),
      ]
    : undefined;

  const ingresosRows =
    dash?.months.map((m) => [
      m.label,
      formatCurrency(m.ingresos.expectedInflowAmount),
      m.ingresos.expectedInflowCount,
      formatCurrency(m.ingresos.actualInflowAmount),
      m.ingresos.actualInflowCount,
      formatCurrency(m.ingresos.actualInflowGrossAmount),
      m.ingresos.actualInflowCount,
      formatCurrency(m.ingresos.varianceAmount),
      m.ingresos.varianceCount,
      pct(m.ingresos.fulfillmentRate),
      pct(m.ingresos.fulfillmentRateByCount),
    ]) ?? [];

  const rollingRows =
    dash?.cxcRollingBalance?.map((m) => [
      m.label,
      formatCurrency(m.openingAmount),
      m.openingCount,
      formatCurrency(m.newEntriesAmount),
      m.newEntriesCount,
      formatCurrency(m.collectionsAmount),
      m.collectionsCount,
      formatCurrency(m.closingAmount),
      m.closingCount,
    ]) ?? [];

  const ingresosTotalRow = totals
    ? [
        "Total año",
        formatCurrency(totals.ingresos.expectedInflowAmount),
        totals.ingresos.expectedInflowCount,
        formatCurrency(totals.ingresos.actualInflowAmount),
        totals.ingresos.actualInflowCount,
        formatCurrency(totals.ingresos.actualInflowGrossAmount),
        totals.ingresos.actualInflowCount,
        formatCurrency(totals.ingresos.varianceAmount),
        totals.ingresos.varianceCount,
        pct(totals.ingresos.fulfillmentRate),
        pct(totals.ingresos.fulfillmentRateByCount),
      ]
    : undefined;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">
            Resumen mensual con montos y cantidad de facturas/documentos en cada indicador.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Cargando dashboard…</div>
      ) : isError ? (
        <div className="py-16 text-center text-red-600">
          {(error as Error)?.message ?? "Error al cargar."}
        </div>
      ) : totals ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {canCxc && (
              <>
                <StatCard
                  label="CxC vencido en el año"
                  amount={formatCurrency(totals.cxc.dueAmount)}
                  count={totals.cxc.dueCount}
                  countLabel="documentos"
                  sub={`${pct(totals.cxc.onTimeRate)} a tiempo ($) · ${pct(totals.cxc.onTimeRateByCount)} a tiempo (#)`}
                  accent="blue"
                />
                <StatCard
                  label="Cobrado a tiempo (CxC)"
                  amount={formatCurrency(totals.cxc.collectedOnTimeAmount)}
                  count={totals.cxc.collectedOnTimeCount}
                  countLabel="documentos"
                  sub={`Tarde: ${formatCurrency(totals.cxc.collectedLateAmount)} (${totals.cxc.collectedLateCount}) · Pendiente: ${formatCurrency(totals.cxc.pendingAmount)} (${totals.cxc.pendingCount})`}
                  accent="green"
                />
                {snapshot && (
                  <StatCard
                    label="Pendiente bruto vencido (hoy)"
                    amount={formatCurrency(snapshot.overduePendingGrossAmount)}
                    count={snapshot.overduePendingGrossCount}
                    countLabel="documentos"
                    sub={`Neto: ${formatCurrency(snapshot.overduePendingNetAmount)} (${snapshot.overduePendingNetCount})`}
                    accent="red"
                  />
                )}
              </>
            )}
            {canCobro && (
              <>
                <StatCard
                  label="Facturación del año"
                  amount={formatCurrency(totals.facturacion.expectedAmount)}
                  count={totals.facturacion.expectedCount}
                  sub={`Conforme: ${formatCurrency(totals.facturacion.receivedConformeAmount)} (${totals.facturacion.receivedConformeCount}) · ${pct(totals.facturacion.receivedConformeRateByCount)}`}
                  accent="amber"
                />
                <StatCard
                  label="Emitidas a tiempo"
                  amount={formatCurrency(totals.facturacion.invoicedOnTimeAmount)}
                  count={totals.facturacion.invoicedOnTimeCount}
                  sub={`De ${totals.facturacion.invoicedCount} emitidas · ${pct(totals.facturacion.invoicedOnTimeRateByCount)}`}
                  accent="green"
                />
                <StatCard
                  label="Sin emitir"
                  amount={formatCurrency(totals.facturacion.pendingInvoiceAmount)}
                  count={totals.facturacion.pendingInvoiceCount}
                  sub="Facturas del periodo aún no cerradas"
                  accent="amber"
                />
              </>
            )}
            {canCxc && (
              <>
                <StatCard
                  label="Ingreso esperado (año)"
                  amount={formatCurrency(totals.ingresos.expectedInflowAmount)}
                  count={totals.ingresos.expectedInflowCount}
                  countLabel="documentos"
                  accent="blue"
                />
                <StatCard
                  label="Ingreso real neto (año)"
                  amount={formatCurrency(totals.ingresos.actualInflowAmount)}
                  count={totals.ingresos.actualInflowCount}
                  countLabel="documentos"
                  sub={`Variación: ${formatCurrency(totals.ingresos.varianceAmount)} (${totals.ingresos.varianceCount >= 0 ? "+" : ""}${totals.ingresos.varianceCount})`}
                  accent={
                    totals.ingresos.varianceAmount >= 0
                      ? "green"
                      : totals.ingresos.varianceAmount < 0
                        ? "red"
                        : undefined
                  }
                />
                <StatCard
                  label="Ingreso bruto (año)"
                  amount={formatCurrency(totals.ingresos.actualInflowGrossAmount)}
                  count={totals.ingresos.actualInflowCount}
                  countLabel="documentos"
                  sub={`${pct(totals.ingresos.fulfillmentRate)} cumpl. ($) · ${pct(totals.ingresos.fulfillmentRateByCount)} cumpl. (#)`}
                  accent="blue"
                />
              </>
            )}
          </div>

          {canCxc && (
            <SectionTable
              title="Cuentas por cobrar — vencimientos del mes"
              description="Por mes de vencimiento. Cada indicador muestra monto ($) y cantidad de documentos (#)."
              headers={[
                "Mes",
                "Vencido $",
                "Vencido #",
                "A tiempo $",
                "A tiempo #",
                "Tarde $",
                "Tarde #",
                "Pendiente $",
                "Pendiente #",
                "% a tiempo $",
                "% a tiempo #",
              ]}
              rows={cxcRows}
              totalRow={cxcTotalRow}
            />
          )}

          {canCxc && rollingRows.length > 0 && (
            <SectionTable
              title="Cuentas por cobrar — balance mes a mes"
              description="Evolución del saldo de CxC por mes: documentos existentes al inicio, entradas nuevas, cobros recibidos y saldo al cierre."
              headers={[
                "Mes",
                "Saldo inicio $",
                "Saldo inicio #",
                "Entradas nuevas $",
                "Entradas nuevas #",
                "Cobros del mes $",
                "Cobros del mes #",
                "Saldo cierre $",
                "Saldo cierre #",
              ]}
              rows={rollingRows}
            />
          )}

          {canCobro && (
            <SectionTable
              title="Facturación mensual — periodo de servicio"
              description="Por mes de periodo del contrato. Monto y cantidad de facturas en cada estado."
              headers={[
                "Mes",
                "A facturar $",
                "A facturar #",
                "Emitidas $",
                "Emitidas #",
                "A tiempo $",
                "A tiempo #",
                "Conforme $",
                "Conforme #",
                "Sin emitir $",
                "Sin emitir #",
                "% conforme $",
                "% conforme #",
                "% a tiempo $",
                "% a tiempo #",
              ]}
              rows={facturacionRows}
              totalRow={facturacionTotalRow}
            />
          )}

          {canCxc && (
            <SectionTable
              title="Ingresos — esperado vs real"
              description="Esperado por mes de pago acordado; real por mes de pago registrado. Bruto = monto original de factura."
              headers={[
                "Mes",
                "Esperado $",
                "Esperado #",
                "Real neto $",
                "Real neto #",
                "Real bruto $",
                "Real bruto #",
                "Variación $",
                "Variación #",
                "% cumpl. $",
                "% cumpl. #",
              ]}
              rows={ingresosRows}
              totalRow={ingresosTotalRow}
            />
          )}

          {!canCobro && !canCxc && (
            <p className="text-sm text-slate-500">No tiene permisos para ver este dashboard.</p>
          )}
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3 text-xs text-slate-500">
        {canCxc && (
          <div className="flex items-start gap-2">
            <Wallet className="h-4 w-4 shrink-0 mt-0.5" />
            <span>CxC: montos netos después de retención del 2&nbsp;% y rebajos manuales.</span>
          </div>
        )}
        {canCobro && (
          <div className="flex items-start gap-2">
            <FileCheck2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Facturación: periodo mensual del contrato; a tiempo = cierre en o antes de la fecha esperada.</span>
          </div>
        )}
        {canCxc && (
          <div className="flex items-start gap-2">
            <Banknote className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Ingresos: neto después de retención/rebajos; bruto = monto original de factura cobrada.</span>
          </div>
        )}
      </div>
    </div>
  );
}
