"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Building2,
  Calendar,
  Wallet,
  Banknote,
  Ticket,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { MetricCard } from "@/components/shared/MetricCard";
import { BudgetBar } from "@/components/shared/BudgetBar";
import { TrafficLightBadge } from "@/components/shared/TrafficLightBadge";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, daysUntilExpiry } from "@/lib/utils/format";
import { companyDisplayName, TrafficLight } from "@/lib/utils/constants";
import { useCompanies } from "@/lib/hooks/use-companies";
import Link from "next/link";
import type { ExecutiveBusinessInsights } from "@/modules/presupuestos/services/executive-insights";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${names[parseInt(m) - 1]} ${y}`;
}

function pct(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

interface TrafficLightReport {
  summary: {
    total: number; green: number; yellow: number; red: number;
    totalBilling: number; totalBudget: number; totalExpenses: number;
  };
  contracts: ContractRow[];
}

interface ContractRow {
  contractId: string; licitacionNo: string; company: string;
  client: string; status: string; startDate: string; endDate: string;
  monthlyBilling: number; suppliesBudget: number; grandTotal: number;
  budgetUsagePctFormatted: number; trafficLight: TrafficLight; isOverBudget: boolean;
}

function PanelLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </Link>
  );
}

function BusinessPanels({
  insights,
  loading,
  month,
}: {
  insights: ExecutiveBusinessInsights | undefined;
  loading: boolean;
  month: string;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Cargando paneles de negocio…
      </div>
    );
  }

  if (!insights) return null;

  const hasAny =
    insights.facturacion ||
    insights.pagos ||
    insights.tickets ||
    insights.disciplinario;

  if (!hasAny) return null;

  const fact = insights.facturacion;
  const pagos = insights.pagos;
  const tickets = insights.tickets;
  const disc = insights.disciplinario;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Paneles críticos de negocio
        </h2>
        <span className="text-xs text-slate-400">{monthLabel(month)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {fact && (
          <>
            {fact.snapshot && (
              <MetricCard
                title="CxC vencido"
                value={formatCurrency(fact.snapshot.overduePendingNetAmount)}
                subtitle={`${fact.snapshot.overduePendingNetCount} documentos pendientes`}
                icon={Wallet}
                color="red"
              />
            )}
            <MetricCard
              title="Por facturar (mes)"
              value={formatCurrency(fact.monthTotals.facturacion.pendingInvoiceAmount)}
              subtitle={`${fact.monthTotals.facturacion.pendingInvoiceCount} facturas · conforme ${pct(fact.monthTotals.facturacion.receivedConformeRate)}`}
              icon={FileText}
              color="yellow"
            />
            {fact.monthTotals.ingresos && (
              <MetricCard
                title="Cobro del mes"
                value={formatCurrency(fact.monthTotals.ingresos.actualInflowAmount)}
                subtitle={`Esperado ${formatCurrency(fact.monthTotals.ingresos.expectedInflowAmount)} · cumplimiento ${pct(fact.monthTotals.ingresos.fulfillmentRate)}`}
                icon={Banknote}
                color="green"
              />
            )}
          </>
        )}

        {pagos && (
          <MetricCard
            title="Cola proveedores"
            value={formatCurrency(pagos.proveedores.unscheduledAmount)}
            subtitle={`${pagos.proveedores.unscheduledCount} sin programar · ${pagos.calendar.unpaidCount} en diario sin pagar`}
            icon={DollarSign}
            color="purple"
          />
        )}

        {tickets && (
          <MetricCard
            title="Tickets TI activos"
            value={String(tickets.active)}
            subtitle={`${tickets.waitingUser} esperando info · ${tickets.overdueSla} SLA vencido`}
            icon={Ticket}
            color={tickets.overdueSla > 0 ? "red" : "blue"}
          />
        )}

        {disc && (
          <MetricCard
            title="Disciplinario (mes)"
            value={String(disc.totalApercibimientos)}
            subtitle={`${disc.tercerUmbralCount} en 3er umbral · ${disc.bajasCount} bajas`}
            icon={ShieldAlert}
            color={disc.tercerUmbralCount > 0 ? "red" : "yellow"}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {fact && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-red-600" />
                  Facturación / CxC
                </CardTitle>
                <PanelLink href={fact.href} label="Ver dashboard" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Facturado mes</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(fact.monthTotals.facturacion.invoicedAmount)}
                  <span className="text-slate-400 font-normal ml-1">
                    ({fact.monthTotals.facturacion.invoicedCount})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Esperado mes</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(fact.monthTotals.facturacion.expectedAmount)}
                </span>
              </div>
              {fact.monthTotals.cxc && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">CxC pendiente mes</span>
                    <span className="font-medium tabular-nums text-amber-700">
                      {formatCurrency(fact.monthTotals.cxc.pendingAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cobro a tiempo (mes)</span>
                    <span className="font-medium tabular-nums">
                      {pct(fact.monthTotals.cxc.onTimeRate)}
                    </span>
                  </div>
                </>
              )}
              {fact.yearOnTimeRate != null && (
                <div className="flex justify-between border-t pt-2">
                  <span className="text-slate-500">Cobro a tiempo (año)</span>
                  <span className="font-medium tabular-nums">{pct(fact.yearOnTimeRate)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {pagos && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-red-600" />
                  Pagos / tesorería
                </CardTitle>
                <PanelLink href={pagos.href} label="Ir a pagos" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Programado en diario</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(pagos.calendar.scheduledAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pagado (verde)</span>
                <span className="font-medium tabular-nums text-green-700">
                  {formatCurrency(pagos.calendar.paidAmount)}
                  <span className="text-slate-400 font-normal ml-1">
                    ({pagos.calendar.paidCount})
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pendiente en diario</span>
                <span className="font-medium tabular-nums text-amber-700">
                  {formatCurrency(pagos.calendar.unpaidAmount)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-slate-500">Cola sin programar</span>
                <span className="font-medium tabular-nums">
                  {pagos.proveedores.unscheduledCount} ·{" "}
                  {formatCurrency(pagos.proveedores.unscheduledAmount)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {tickets && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-red-600" />
                  Tickets TI
                </CardTitle>
                <PanelLink href={tickets.href} label="Centro TI" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Activos</span>
                <span className="font-medium tabular-nums">{tickets.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Esperando información</span>
                <span className="font-medium tabular-nums">{tickets.waitingUser}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SLA vencido</span>
                <span
                  className={`font-medium tabular-nums ${
                    tickets.overdueSla > 0 ? "text-red-700" : "text-slate-800"
                  }`}
                >
                  {tickets.overdueSla}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {disc && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  Disciplinario
                </CardTitle>
                <PanelLink href={disc.href} label="Ver dashboard" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Apercibimientos</span>
                <span className="font-medium tabular-nums">{disc.totalApercibimientos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cobrados</span>
                <span className="font-medium tabular-nums">
                  {disc.cobradosCount} · {formatCurrency(disc.cobradosMonto)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">3er umbral</span>
                <span
                  className={`font-medium tabular-nums ${
                    disc.tercerUmbralCount > 0 ? "text-red-700" : "text-slate-800"
                  }`}
                >
                  {disc.tercerUmbralCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bajas</span>
                <span className="font-medium tabular-nums">{disc.bajasCount}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];

  const { data, isLoading } = useQuery<{ data: TrafficLightReport }>({
    queryKey: ["traffic-light", month],
    queryFn: () => fetch(`/api/reports/traffic-light?month=${month}`).then((r) => r.json()),
  });

  const { data: insightsRes, isLoading: insightsLoading } = useQuery<{
    data: ExecutiveBusinessInsights;
  }>({
    queryKey: ["executive-insights", month],
    queryFn: async () => {
      const r = await fetch(`/api/dashboard/executive?month=${month}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar paneles");
      return json;
    },
    staleTime: 2 * 60 * 1000,
  });

  const report = data?.data;
  const contracts = report?.contracts ?? [];
  const insights = insightsRes?.data;

  const atRisk = [...contracts]
    .sort((a, b) => b.budgetUsagePctFormatted - a.budgetUsagePctFormatted)
    .slice(0, 8);

  const expiringSoon = contracts
    .filter((c) => c.status === "ACTIVE" || c.status === "PROLONGATION")
    .filter((c) => {
      const days = daysUntilExpiry(c.endDate);
      return days >= 0 && days <= 90;
    })
    .sort((a, b) => daysUntilExpiry(a.endDate) - daysUntilExpiry(b.endDate))
    .slice(0, 5);

  const byCompany = contracts.reduce<Record<string, { green: number; yellow: number; red: number; total: number }>>((acc, c) => {
    if (!acc[c.company]) acc[c.company] = { green: 0, yellow: 0, red: 0, total: 0 };
    acc[c.company].total++;
    acc[c.company][c.trafficLight.toLowerCase() as "green" | "yellow" | "red"]++;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <>
        <Topbar title="Dashboard" />
        <div className="p-8 flex items-center justify-center h-96">
          <div className="text-slate-500">Cargando datos...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Dashboard Ejecutivo" />
      <div className="p-6 space-y-6">

        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-600">Período:</span>
          <Input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="w-40 h-8 text-sm"
          />
          <span className="text-sm text-slate-500">{monthLabel(month)}</span>
          {month !== currentMonth() && (
            <button
              onClick={() => setMonth(currentMonth())}
              className="text-xs text-red-600 hover:underline"
            >
              Volver al mes actual
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Contratos Activos"
            value={String(report?.summary.total ?? 0)}
            subtitle="En el sistema"
            icon={FileText}
            color="blue"
          />
          <MetricCard
            title="Facturación Mensual"
            value={formatCurrency(report?.summary.totalBilling ?? 0)}
            subtitle="Ingresos totales"
            icon={DollarSign}
            color="green"
          />
          <MetricCard
            title="Contratos en Riesgo"
            value={String(report?.summary.red ?? 0)}
            subtitle={`${report?.summary.yellow ?? 0} en precaución`}
            icon={AlertTriangle}
            color="red"
          />
          <MetricCard
            title="Presupuesto Ejecutado"
            value={report?.summary.totalBudget
              ? `${((report.summary.totalExpenses / report.summary.totalBudget) * 100).toFixed(1)}%`
              : "0%"}
            subtitle={`Gastos: ${formatCurrency(report?.summary.totalExpenses ?? 0)} · Ppto: ${formatCurrency(report?.summary.totalBudget ?? 0)}`}
            icon={TrendingUp}
            color="purple"
          />
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <span className="text-sm font-medium text-slate-600">Semáforo General:</span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm text-slate-600">Normal: <strong>{report?.summary.green ?? 0}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="text-sm text-slate-600">Precaución: <strong>{report?.summary.yellow ?? 0}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="text-sm text-slate-600">Crítico: <strong>{report?.summary.red ?? 0}</strong></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <BusinessPanels insights={insights} loading={insightsLoading} month={month} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-red-600" />
                Estado por Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {Object.entries(byCompany).map(([company, stats]) => (
                  <div key={company} className="flex items-center justify-between px-6 py-3">
                    <span className="text-sm font-medium">{companyDisplayName(company, companyRows)}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-green-600 font-medium w-6 text-center">{stats.green}</span>
                      <span className="text-xs text-yellow-600 font-medium w-6 text-center">{stats.yellow}</span>
                      <span className="text-xs text-red-600 font-medium w-6 text-center">{stats.red}</span>
                      <span className="text-xs text-slate-400 ml-1">/ {stats.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Mayor Ejecución de Presupuesto — {monthLabel(month)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {atRisk.map((c) => (
                  <Link
                    key={c.contractId}
                    href={`/contracts/${c.contractId}`}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <TrafficLightBadge light={c.trafficLight} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{c.client}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{companyDisplayName(c.company, companyRows)}</Badge>
                      </div>
                      <BudgetBar
                        pct={c.budgetUsagePctFormatted}
                        light={c.trafficLight}
                        showLabel={false}
                        height="sm"
                      />
                    </div>
                    <span className="text-sm font-bold shrink-0 w-16 text-right">
                      {c.budgetUsagePctFormatted.toFixed(1)}%
                    </span>
                  </Link>
                ))}
                {atRisk.length === 0 && (
                  <div className="px-6 py-8 text-center text-slate-400 text-sm">
                    No hay contratos con datos de gasto
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {expiringSoon.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Contratos Próximos a Vencer (90 días)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {expiringSoon.map((c) => {
                  const days = daysUntilExpiry(c.endDate);
                  return (
                    <Link
                      key={c.contractId}
                      href={`/contracts/${c.contractId}`}
                      className="flex items-center justify-between px-6 py-3 hover:bg-amber-50 transition-colors"
                    >
                      <div>
                        <span className="text-sm font-medium">{c.client}</span>
                        <span className="text-xs text-slate-400 ml-2">— {companyDisplayName(c.company, companyRows)}</span>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Inicio: {formatDate(c.startDate)} · Vence: {formatDate(c.endDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={days <= 30 ? "danger" : "warning"}>
                          {days} días
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
