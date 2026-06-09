"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, TrendingUp, AlertTriangle, DollarSign, Building2,
  Calendar, ChevronRight, ArrowUpRight, ArrowDownRight,
  PieChart, BarChart3
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Sector
} from "recharts";
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
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Setiembre","Octubre","Noviembre","Diciembre"];
  return `${names[parseInt(m) - 1]} ${y}`;
}

interface TrafficLightReport {
  summary: { total: number; green: number; yellow: number; red: number; totalBilling: number; totalBudget: number; totalExpenses: number; };
  contracts: ContractRow[];
}

interface ContractRow {
  contractId: string; licitacionNo: string; company: string;
  client: string; status: string; startDate: string; endDate: string;
  monthlyBilling: number; suppliesBudget: number; grandTotal: number;
  budgetUsagePctFormatted: number; trafficLight: TrafficLight; isOverBudget: boolean;
}

interface MonthlyTrend {
  month: string;
  label: string;
  billing: number;
  expenses: number;
  contracts: number;
}

const TRAFFIC_LIGHT_COLORS: Record<string, string> = {
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  RED: "#ef4444",
};

// Custom active shape for donut
function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#475569" fontSize={12} fontWeight={500}>
        {payload.label}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#0f172a" fontSize={22} fontWeight={700}>
        {value}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#94a3b8" fontSize={11}>
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 4} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 8} outerRadius={outerRadius + 12} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [activeDonutIndex, setActiveDonutIndex] = useState(0);
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];

  const { data, isLoading } = useQuery<{ data: TrafficLightReport }>({
    queryKey: ["traffic-light", month],
    queryFn: () => fetch(`/api/reports/traffic-light?month=${month}`).then((r) => r.json()),
  });

  // Simulated monthly trend (last 6 months) — in real app, fetch from API
  const { data: trendData } = useQuery<{ data: MonthlyTrend[] }>({
    queryKey: ["billing-trend"],
    queryFn: () => fetch("/api/reports/billing-trend?months=6").then((r) => r.json()),
    staleTime: 60_000,
  });
  const monthlyTrend = trendData?.data;

  const report = data?.data;
  const contracts = report?.contracts ?? [];
  const summary = report?.summary;

  // Top at-risk contracts
  const atRisk = useMemo(() =>
    [...contracts].sort((a, b) => b.budgetUsagePctFormatted - a.budgetUsagePctFormatted).slice(0, 8),
    [contracts]
  );

  // Expiring soon (≤90 days)
  const expiringSoon = useMemo(() =>
    contracts
      .filter((c) => c.status === "ACTIVE" || c.status === "PROLONGATION")
      .filter((c) => {
        const days = daysUntilExpiry(c.endDate);
        return days >= 0 && days <= 90;
      })
      .sort((a, b) => daysUntilExpiry(a.endDate) - daysUntilExpiry(b.endDate))
      .slice(0, 5),
    [contracts]
  );

  // By company
  const byCompany = useMemo(() =>
    contracts.reduce<Record<string, { green: number; yellow: number; red: number; total: number }>>((acc, c) => {
      if (!acc[c.company]) acc[c.company] = { green: 0, yellow: 0, red: 0, total: 0 };
      acc[c.company].total++;
      acc[c.company][c.trafficLight.toLowerCase() as "green" | "yellow" | "red"]++;
      return acc;
    }, {}),
    [contracts]
  );

  // Donut chart data
  const donutData = useMemo(() => [
    { name: "GREEN", label: "Normal", value: summary?.green ?? 0, color: TRAFFIC_LIGHT_COLORS.GREEN },
    { name: "YELLOW", label: "Precaución", value: summary?.yellow ?? 0, color: TRAFFIC_LIGHT_COLORS.YELLOW },
    { name: "RED", label: "Crítico", value: summary?.red ?? 0, color: TRAFFIC_LIGHT_COLORS.RED },
  ].filter(d => d.value > 0), [summary]);

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

  // Stats for compact display
  const totalContracts = summary?.total ?? 0;
  const billingAmount = summary?.totalBilling ?? 0;
  const riskCount = summary?.red ?? 0;
  const budgetPct = summary?.totalBudget
    ? ((summary.totalExpenses / summary.totalBudget) * 100).toFixed(1)
    : "0.0";

  return (
    <>
      <Topbar title="Dashboard Ejecutivo" />
      <div className="p-4 md:p-6 space-y-5">

        {/* === HEADER: selector de mes + resumen compacto === */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              <button onClick={() => setMonth(currentMonth())} className="text-xs text-blue-600 hover:underline font-medium">
                Volver al mes actual
              </button>
            )}
          </div>
          {/* Quick stat chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <FileText className="h-3 w-3" />
              {totalContracts} contratos
            </span>
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              riskCount > 5 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
            )}>
              <AlertTriangle className="h-3 w-3" />
              {riskCount} en riesgo
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
              <BarChart3 className="h-3 w-3" />
              {budgetPct}% ejecutado
            </span>
          </div>
        </div>

        {/* === KPI CARDS (4 columnas) === */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <MetricCard
            title="Contratos Activos"
            value={String(totalContracts)}
            subtitle="En el sistema"
            icon={FileText}
            color="blue"
          />
          <MetricCard
            title="Facturación Mensual"
            value={formatCurrency(billingAmount)}
            subtitle="Ingresos totales"
            icon={DollarSign}
            color="green"
          />
          <MetricCard
            title="Contratos en Riesgo"
            value={String(riskCount)}
            subtitle={`${summary?.yellow ?? 0} en precaución`}
            icon={AlertTriangle}
            color="red"
          />
          <MetricCard
            title="Presupuesto Ejecutado"
            value={`${budgetPct}%`}
            subtitle={`Gastos: ${formatCurrency(summary?.totalExpenses ?? 0)} / Ppto: ${formatCurrency(summary?.totalBudget ?? 0)}`}
            icon={TrendingUp}
            color="purple"
          />
        </div>

        {/* === SEMÁFORO + DONUT + BILLING TREND === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Donut chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Distribución por Semáforo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {donutData.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <RePieChart>
                      <Pie
                        activeIndex={activeDonutIndex}
                        activeShape={renderActiveShape}
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        dataKey="value"
                        onMouseEnter={(_, index) => setActiveDonutIndex(index)}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </RePieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div className="flex gap-4 mt-2">
                    {donutData.map((d) => (
                      <div
                        key={d.name}
                        className="flex items-center gap-1.5 cursor-pointer"
                        onMouseEnter={() => setActiveDonutIndex(donutData.indexOf(d))}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-xs text-slate-500">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">
                  Sin datos para este período
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bar chart - Monthly billing trend */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Tendencia de Facturación
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyTrend && monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₡${(v / 1000000).toFixed(0)}M`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "billing") return [formatCurrency(value), "Facturación"];
                        if (name === "expenses") return [formatCurrency(value), "Gastos"];
                        return [value, name];
                      }}
                      labelFormatter={(label) => `${label}`}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="billing" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32} name="billing" />
                    <Bar dataKey="expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32} name="expenses" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">
                  Datos de tendencia no disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* === STATUS BAR: semáforo general === */}
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-3 md:gap-6">
              <span className="text-sm font-medium text-slate-600">Semáforo General:</span>
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                  <span className="text-xs md:text-sm text-slate-600">
                    Normal: <strong className="text-green-700">{summary?.green ?? 0}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  <span className="text-xs md:text-sm text-slate-600">
                    Precaución: <strong className="text-yellow-700">{summary?.yellow ?? 0}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <span className="text-xs md:text-sm text-slate-600">
                    Crítico: <strong className="text-red-700">{summary?.red ?? 0}</strong>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* === BOTTOM ROW: by company + at-risk + expiring === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* By company */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Estado por Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {Object.entries(byCompany).map(([company, stats]) => (
                  <div key={company} className="flex items-center justify-between px-4 md:px-6 py-2.5">
                    <span className="text-xs md:text-sm font-medium">{companyDisplayName(company, companyRows)}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-green-600 font-semibold w-5 text-center">{stats.green}</span>
                      <span className="text-xs text-yellow-600 font-semibold w-5 text-center">{stats.yellow}</span>
                      <span className="text-xs text-red-600 font-semibold w-5 text-center">{stats.red}</span>
                      <span className="text-xs text-slate-400 ml-1">/ {stats.total}</span>
                    </div>
                  </div>
                ))}
                {Object.keys(byCompany).length === 0 && (
                  <div className="px-6 py-8 text-center text-slate-400 text-sm">Sin datos</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top at-risk */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Mayor Ejecución de Presupuesto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {atRisk.map((c) => (
                  <Link
                    key={c.contractId}
                    href={`/contracts/${c.contractId}`}
                    className="flex items-center gap-3 px-4 md:px-6 py-2.5 hover:bg-muted/50 transition-colors group"
                  >
                    <TrafficLightBadge light={c.trafficLight} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs md:text-sm font-medium truncate">{c.client}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0">{companyDisplayName(c.company, companyRows)}</Badge>
                      </div>
                      <BudgetBar pct={c.budgetUsagePctFormatted} light={c.trafficLight} showLabel={false} height="sm" />
                    </div>
                    <span className={cn(
                      "text-xs md:text-sm font-bold shrink-0",
                      c.trafficLight === "RED" ? "text-red-600" : c.trafficLight === "YELLOW" ? "text-yellow-600" : "text-green-600"
                    )}>
                      {c.budgetUsagePctFormatted.toFixed(1)}%
                    </span>
                  </Link>
                ))}
                {atRisk.length === 0 && (
                  <div className="px-6 py-8 text-center text-slate-400 text-sm">Sin contratos con datos de gasto</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Expiring soon */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-4 w-4" />
                Próximos a Vencer (90 días)
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
                      className="flex items-center justify-between px-4 md:px-6 py-2.5 hover:bg-orange-50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs md:text-sm font-medium truncate block">{c.client}</span>
                        <span className="text-[10px] md:text-xs text-slate-400">
                          Vence: {formatDate(c.endDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant={days <= 30 ? "danger" : "warning"} className="text-[10px] px-1.5 py-0">
                          {days} días
                        </Badge>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
                {expiringSoon.length === 0 && (
                  <div className="px-6 py-8 text-center text-slate-400 text-sm">Ningún contrato próximo a vencer</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
