"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrafficLightBadge } from "@/components/shared/TrafficLightBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { formatCurrency, toPreviousMonthString } from "@/lib/utils/format";
import {
  companyDisplayName,
  CLIENT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  TrafficLight,
  REPORT_PARTIDA_OPTIONS,
  type ReportPartidaFilter,
} from "@/lib/utils/constants";
import type { RubroTrafficSnapshot } from "@/modules/presupuestos/business/profitability";
import { useCompanies } from "@/lib/hooks/use-companies";
import { BarChart3, Download, DollarSign, TrendingUp, AlertTriangle, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { cn } from "@/lib/utils/cn";
import {
  RubroSpendDrilldownDialog,
  type RubroSpendDrilldownRubro,
  type RubroSpendDrilldownTarget,
} from "@/components/reports/RubroSpendDrilldownDialog";
import { expenseTypeLabel } from "@/lib/utils/expense-type-labels";

const REPORT_TABLE_HEADER_TH =
  "sticky top-0 z-20 bg-slate-50 align-top border-b border-slate-200 shadow-[0_1px_0_0_rgb(226,232,240)] px-3 py-2";
const REPORT_TABLE_FILTER_TH =
  "sticky top-[2.25rem] z-20 bg-muted/50 align-top border-b border-slate-200 px-2 py-1.5";

interface ExpenseTypeColumn {
  type: string;
  label: string;
}

interface ProfitabilityRow {
  contractId: string;
  licitacionNo: string; company: string; client: string; clientType: string;
  status: string; officersCount: number; positionsCount: number; equivalencePct: number;
  monthlyBilling: number;
  suppliesBudgetPct: number;
  laborBudget: number;
  suppliesBudget: number;
  adminBudget: number;
  profitBudget: number;
  reportPartida: ReportPartidaFilter;
  reportBudget: number;
  reportBudgetPct: number;
  uniformsTotal: number; auditTotal: number; deferredTotal: number; adminTotal: number;
  expensesByTypeMerged: Record<string, number>;
  grandTotal: number;
  grandTotalAll: number;
  budgetUsagePct: number; budgetUsagePctFormatted: number; trafficLight: TrafficLight;
  rubroTraffic: {
    LABOR: RubroTrafficSnapshot;
    SUPPLIES: RubroTrafficSnapshot;
    ADMIN: RubroTrafficSnapshot;
    PROFIT: RubroTrafficSnapshot;
  };
  remaining: number; isOverBudget: boolean;
}

interface ProfitabilityReport {
  rows: ProfitabilityRow[];
  expenseTypeColumns: ExpenseTypeColumn[];
  totals: {
    partida: ReportPartidaFilter;
    totalBilling: number;
    totalLaborBudget: number;
    totalSuppliesBudget: number;
    totalAdminBudget: number;
    totalProfitBudget: number;
    totalLaborSpend: number;
    totalSuppliesSpend: number;
    totalAdminSpend: number;
    totalProfitSpend: number;
    totalReportBudget: number;
    totalUniforms: number;
    totalAudit: number;
    totalDeferred: number;
    totalAdmin: number;
    totalExpenses: number; avgUsagePct: number;
    totalsByType: Record<string, number>;
  };
}

export default function ReportsPage() {
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(toPreviousMonthString());
  const [selectedPartida, setSelectedPartida] = useState<ReportPartidaFilter>("ALL");
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];

  const params = new URLSearchParams();
  companyFilter.forEach((c) => params.append("company", c));
  if (selectedMonth) params.set("month", selectedMonth);
  if (selectedPartida !== "ALL") params.set("partida", selectedPartida);

  const { data, isLoading, isFetching } = useQuery<{ data: ProfitabilityReport }>({
    queryKey: ["profitability-report", companyFilter, selectedMonth, selectedPartida],
    queryFn: () => fetch(`/api/reports/profitability?${params}`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const report = data?.data;
  const rows = report?.rows ?? [];
  const expenseTypeColumns = report?.expenseTypeColumns ?? [];
  const partida = report?.totals?.partida ?? selectedPartida;
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [rubroDrilldown, setRubroDrilldown] = useState<RubroSpendDrilldownTarget | null>(null);
  const onColumnFilterChange = (k: string, v: string) => setColumnFilters((p) => ({ ...p, [k]: v }));

  const openRubroDrilldown = (
    row: ProfitabilityRow,
    rubro: RubroSpendDrilldownRubro,
  ) => {
    if (!selectedMonth) return;
    setRubroDrilldown({
      contractId: row.contractId,
      licitacionNo: row.licitacionNo,
      client: row.client,
      month: selectedMonth,
      rubro,
    });
  };
  const columnDefs = useMemo((): TableColumnFilterDef<ProfitabilityRow>[] => {
    const base = [
      { key: "licitacion", label: "Licitación", getValue: (r: ProfitabilityRow) => r.licitacionNo },
      { key: "cliente", label: "Cliente", getValue: (r: ProfitabilityRow) => r.client },
      { key: "empresa", label: "Empresa", getValue: (r: ProfitabilityRow) => companyDisplayName(r.company, companyRows) },
      { key: "facturacion", label: "Facturación", getValue: (r: ProfitabilityRow) => String(r.monthlyBilling) },
    ] as TableColumnFilterDef<ProfitabilityRow>[];
    if (partida === "ALL") {
      base.push(
        { key: "mo", label: "Mano de obra", getValue: (r) => String(r.rubroTraffic.LABOR.spend) },
        { key: "insumos", label: "Insumos", getValue: (r) => String(r.rubroTraffic.SUPPLIES.spend) },
        { key: "adm", label: "Administrativo", getValue: (r) => String(r.rubroTraffic.ADMIN.spend) },
        { key: "util", label: "Utilidad", getValue: (r) => String(r.rubroTraffic.PROFIT.spend) }
      );
    } else {
      base.push({
        key: "presupuesto",
        label: "Gasto / presupuesto",
        getValue: (r) => String(r.grandTotal),
      });
    }
    for (const col of expenseTypeColumns) {
      base.push({ key: `type_${col.type}`, label: col.label, getValue: (r) => String(r.expensesByTypeMerged[col.type] ?? 0) });
    }
    base.push({ key: "total", label: "Total", getValue: (r) => String(r.grandTotal) });
    base.push({ key: "peor", label: "Peor partida", getValue: (r) => r.trafficLight });
    return base.map((col) => ({
      ...col,
      headerClassName: cn(col.headerClassName, REPORT_TABLE_HEADER_TH),
      filterClassName: cn(col.filterClassName, REPORT_TABLE_FILTER_TH),
    }));
  }, [expenseTypeColumns, partida, companyRows]);

  const displayedRows = useMemo(
    () =>
      filterRowsByColumnFilters(
        rows,
        columnFilters,
        columnDefs.map((c) => ({ key: c.key, getValue: c.getValue, mode: c.mode, filterable: c.filterable }))
      ),
    [rows, columnDefs, columnFilters]
  );

  /** Totales alineados con las filas visibles (filtros de columna). */
  const displayTotals = useMemo(() => {
    const totalsByType: Record<string, number> = {};
    for (const col of expenseTypeColumns) {
      totalsByType[col.type] = displayedRows.reduce(
        (s, r) => s + (r.expensesByTypeMerged[col.type] ?? 0),
        0
      );
    }
    return {
      partida,
      totalBilling: displayedRows.reduce((s, r) => s + r.monthlyBilling, 0),
      totalLaborBudget: displayedRows.reduce((s, r) => s + r.laborBudget, 0),
      totalSuppliesBudget: displayedRows.reduce((s, r) => s + r.suppliesBudget, 0),
      totalAdminBudget: displayedRows.reduce((s, r) => s + r.adminBudget, 0),
      totalProfitBudget: displayedRows.reduce((s, r) => s + r.profitBudget, 0),
      totalLaborSpend: displayedRows.reduce((s, r) => s + r.rubroTraffic.LABOR.spend, 0),
      totalLaborCargasSpend: displayedRows.reduce(
        (s, r) => s + (r.rubroTraffic.LABOR.cargasSocialesSpend ?? 0),
        0
      ),
      totalSuppliesSpend: displayedRows.reduce((s, r) => s + r.rubroTraffic.SUPPLIES.spend, 0),
      totalAdminSpend: displayedRows.reduce((s, r) => s + r.rubroTraffic.ADMIN.spend, 0),
      totalProfitSpend: displayedRows.reduce((s, r) => s + r.rubroTraffic.PROFIT.spend, 0),
      totalReportBudget:
        partida === "ALL"
          ? 0
          : displayedRows.reduce((s, r) => s + r.reportBudget, 0),
      totalUniforms: displayedRows.reduce((s, r) => s + r.uniformsTotal, 0),
      totalAudit: displayedRows.reduce((s, r) => s + r.auditTotal, 0),
      totalDeferred: displayedRows.reduce((s, r) => s + r.deferredTotal, 0),
      totalAdmin: displayedRows.reduce((s, r) => s + r.adminTotal, 0),
      totalExpenses: displayedRows.reduce((s, r) => s + r.grandTotal, 0),
      totalSpendAll: displayedRows.reduce((s, r) => s + (r.grandTotalAll ?? r.grandTotal), 0),
      totalFullBudget: displayedRows.reduce(
        (s, r) => s + r.laborBudget + r.suppliesBudget + r.adminBudget + r.profitBudget,
        0
      ),
      avgUsagePct:
        displayedRows.length > 0
          ? displayedRows.reduce((s, r) => s + r.budgetUsagePct, 0) / displayedRows.length
          : 0,
      totalsByType,
      totalOperatingBudget:
        partida === "ALL"
          ? displayedRows.reduce(
              (s, r) => s + r.laborBudget + r.suppliesBudget + r.adminBudget + r.profitBudget,
              0
            )
          : displayedRows.reduce((s, r) => s + r.reportBudget, 0),
      budgetVariance:
        partida === "ALL"
          ? displayedRows.reduce(
              (s, r) => s + r.laborBudget + r.suppliesBudget + r.adminBudget + r.profitBudget,
              0
            ) - displayedRows.reduce((s, r) => s + (r.grandTotalAll ?? r.grandTotal), 0)
          : displayedRows.reduce((s, r) => s + r.reportBudget, 0) -
            displayedRows.reduce((s, r) => s + r.grandTotal, 0),
      generalBalance:
        displayedRows.reduce((s, r) => s + r.monthlyBilling, 0) -
        displayedRows.reduce((s, r) => s + (r.grandTotalAll ?? r.grandTotal), 0),
    };
  }, [displayedRows, expenseTypeColumns, partida]);

  const openConsolidatedRubroDrilldown = (rubro: RubroSpendDrilldownRubro) => {
    if (!selectedMonth || displayedRows.length === 0) return;
    setRubroDrilldown({
      consolidated: true,
      contractIds: displayedRows.map((r) => r.contractId),
      licitacionNo: `TOTALES (${displayedRows.length} contratos)`,
      client: "Consolidado del reporte mensual",
      month: selectedMonth,
      rubro,
    });
  };

  const trafficCounts = useMemo(
    () =>
      displayedRows.reduce(
        (acc, r) => {
          acc[r.trafficLight]++;
          return acc;
        },
        { GREEN: 0, YELLOW: 0, RED: 0 }
      ),
    [displayedRows]
  );

  const rubroColCount = partida === "ALL" ? 4 : 1;
  const tableColCount = 4 + rubroColCount + expenseTypeColumns.length + 2;

  const consolidatedExpenseEntries = useMemo(
    () =>
      expenseTypeColumns
        .map((col) => ({
          type: col.type,
          label: col.label,
          amount: (displayTotals.totalsByType ?? {})[col.type] ?? 0,
        }))
        .filter((e) => e.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [displayTotals.totalsByType, expenseTypeColumns]
  );

  const partidaLabel =
    REPORT_PARTIDA_OPTIONS.find((o) => o.value === selectedPartida)?.label ?? "Todas las partidas";

  function toNumPct(budget: number, billing: number): number {
    if (billing <= 0) return 0;
    return budget / billing;
  }

  function pctOfBillingStr(amount: number, billing: number): string {
    return `${(toNumPct(amount, billing) * 100).toFixed(1)}%`;
  }

  function spendUsagePct(spend: number, budget: number): string {
    if (budget <= 0) return "—";
    return `${((spend / budget) * 100).toFixed(1)}%`;
  }

  function ConsolidatedSpendChip({
    label,
    spend,
    budget,
  }: {
    label: string;
    spend: number;
    budget: number;
  }) {
    return (
      <span className="tabular-nums whitespace-nowrap">
        <span className="text-slate-600">{label}:</span>{" "}
        <span className="font-semibold text-slate-900">{formatCurrency(spend)}</span>
        {budget > 0 && (
          <span className="text-slate-500 ml-1">({spendUsagePct(spend, budget)} del P.)</span>
        )}
      </span>
    );
  }

  function ReportGeneralBalanceSummary({
    totals,
    partida,
    contractCount,
  }: {
    totals: {
      totalBilling: number;
      totalExpenses: number;
      totalSpendAll: number;
      totalOperatingBudget: number;
      budgetVariance: number;
      generalBalance: number;
    };
    partida: ReportPartidaFilter;
    contractCount: number;
  }) {
    if (contractCount === 0) return null;
    const budgetPositive = totals.budgetVariance >= 0;
    const generalPositive = totals.generalBalance >= 0;
    return (
      <div className="border-t-2 border-slate-300 bg-slate-50/90 px-4 py-4">
        <h4 className="text-sm font-semibold text-slate-800 mb-3">Balance general del mes</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded-lg border bg-white px-3 py-2">
            <p className="text-xs text-slate-500">Gasto total del mes</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(totals.totalSpendAll)}</p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2">
            <p className="text-xs text-slate-500">
              {partida === "ALL" ? "Presupuesto (MO + Insumos + Adm. + Utilidad)" : "Presupuesto partida"}
            </p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(totals.totalOperatingBudget)}</p>
          </div>
          <div
            className={cn(
              "rounded-lg border px-3 py-2",
              budgetPositive ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
            )}
          >
            <p className="text-xs text-slate-600">{budgetPositive ? "Sobró del presupuesto" : "Faltó del presupuesto"}</p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums",
                budgetPositive ? "text-green-800" : "text-red-800"
              )}
            >
              {formatCurrency(Math.abs(totals.budgetVariance))}
            </p>
          </div>
          <div
            className={cn(
              "rounded-lg border px-3 py-2",
              generalPositive ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
            )}
          >
            <p className="text-xs text-slate-600">Balance general (Facturación − Gastos)</p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums",
                generalPositive ? "text-green-800" : "text-red-800"
              )}
            >
              {generalPositive ? "Positivo" : "Negativo"} · {formatCurrency(Math.abs(totals.generalBalance))}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function exportToExcel() {
    if (!displayedRows.length) return;

    const buildRow = (r: ProfitabilityRow): Record<string, string | number> => {
      const o: Record<string, string | number> = {
        "ID contrato": r.contractId,
        "N° Licitación": r.licitacionNo,
        Empresa: companyDisplayName(r.company, companyRows),
        Cliente: r.client,
        Tipo: CLIENT_TYPE_LABELS[r.clientType as keyof typeof CLIENT_TYPE_LABELS],
        Estado: CONTRACT_STATUS_LABELS[r.status as keyof typeof CONTRACT_STATUS_LABELS],
        Oficiales: r.officersCount,
        Puestos: r.positionsCount,
        "Equiv. %": `${(r.equivalencePct * 100).toFixed(2)}%`,
        "Facturación mensual": r.monthlyBilling,
        "Vista / partida": partidaLabel,
      };

      if (partida === "ALL") {
        o["Gasto mano de obra"] = r.rubroTraffic.LABOR.spend;
        o["P. mano de obra"] = r.laborBudget;
        o["% P. MO (s/ fact.)"] = pctOfBillingStr(r.laborBudget, r.monthlyBilling);
        o["% ejec. MO"] = `${r.rubroTraffic.LABOR.usagePctFormatted.toFixed(1)}%`;
        o["Sem. MO"] = r.rubroTraffic.LABOR.trafficLight;
        o["Gasto insumos"] = r.rubroTraffic.SUPPLIES.spend;
        o["P. insumos"] = r.suppliesBudget;
        o["% P. insumos (s/ fact.)"] = pctOfBillingStr(r.suppliesBudget, r.monthlyBilling);
        o["% ejec. insumos"] = `${r.rubroTraffic.SUPPLIES.usagePctFormatted.toFixed(1)}%`;
        o["Sem. insumos"] = r.rubroTraffic.SUPPLIES.trafficLight;
        o["Gasto administrativo"] = r.rubroTraffic.ADMIN.spend;
        o["P. administrativo"] = r.adminBudget;
        o["% P. adm. (s/ fact.)"] = pctOfBillingStr(r.adminBudget, r.monthlyBilling);
        o["% ejec. adm."] = `${r.rubroTraffic.ADMIN.usagePctFormatted.toFixed(1)}%`;
        o["Sem. adm."] = r.rubroTraffic.ADMIN.trafficLight;
        o["Gasto utilidad"] = r.rubroTraffic.PROFIT.spend;
        o["P. utilidad"] = r.profitBudget;
        o["% P. utilidad (s/ fact.)"] = pctOfBillingStr(r.profitBudget, r.monthlyBilling);
        o["% ejec. utilidad"] = `${r.rubroTraffic.PROFIT.usagePctFormatted.toFixed(1)}%`;
        o["Sem. utilidad"] = r.rubroTraffic.PROFIT.trafficLight;
      } else {
        o.Gasto = r.grandTotal;
        o.Presupuesto = r.reportBudget;
        o["% presup. (s/ fact.)"] = `${(r.reportBudgetPct * 100).toFixed(1)}%`;
        o["% ejec."] = `${r.budgetUsagePctFormatted.toFixed(1)}%`;
      }

      for (const col of expenseTypeColumns) {
        o[col.label] = r.expensesByTypeMerged[col.type] ?? 0;
      }
      o["Total gastos"] = r.grandTotal;
      o["% ejec. (peor partida)"] = `${r.budgetUsagePctFormatted.toFixed(1)}%`;
      o["Semáforo peor partida"] = r.trafficLight;
      o["Disponible / variación"] = r.remaining;
      return o;
    };

    const exportData = displayedRows.map(buildRow);
    const t = displayTotals;

    const totalsRow: Record<string, string | number> = {
      "ID contrato": "",
      "N° Licitación": "TOTALES",
      Empresa: "",
      Cliente: "",
      Tipo: "",
      Estado: "",
      Oficiales: "",
      Puestos: "",
      "Equiv. %": "",
      "Facturación mensual": t.totalBilling,
      "Vista / partida": partidaLabel,
    };

    if (partida === "ALL") {
      totalsRow["Gasto mano de obra"] = t.totalLaborSpend;
      totalsRow["P. mano de obra"] = t.totalLaborBudget;
      totalsRow["% P. MO (s/ fact.)"] = pctOfBillingStr(t.totalLaborBudget, t.totalBilling);
      totalsRow["% ejec. MO"] = "";
      totalsRow["Sem. MO"] = "";
      totalsRow["Gasto insumos"] = t.totalSuppliesSpend;
      totalsRow["P. insumos"] = t.totalSuppliesBudget;
      totalsRow["% P. insumos (s/ fact.)"] = pctOfBillingStr(t.totalSuppliesBudget, t.totalBilling);
      totalsRow["% ejec. insumos"] = "";
      totalsRow["Sem. insumos"] = "";
      totalsRow["Gasto administrativo"] = t.totalAdminSpend;
      totalsRow["P. administrativo"] = t.totalAdminBudget;
      totalsRow["% P. adm. (s/ fact.)"] = pctOfBillingStr(t.totalAdminBudget, t.totalBilling);
      totalsRow["% ejec. adm."] = "";
      totalsRow["Sem. adm."] = "";
      totalsRow["Gasto utilidad"] = t.totalProfitSpend;
      totalsRow["P. utilidad"] = t.totalProfitBudget;
      totalsRow["% P. utilidad (s/ fact.)"] = pctOfBillingStr(t.totalProfitBudget, t.totalBilling);
      totalsRow["% ejec. utilidad"] = "";
      totalsRow["Sem. utilidad"] = "";
    } else {
      totalsRow.Gasto = t.totalExpenses;
      totalsRow.Presupuesto = t.totalReportBudget;
      totalsRow["% presup. (s/ fact.)"] = pctOfBillingStr(t.totalReportBudget, t.totalBilling);
      totalsRow["% ejec."] = "";
    }

    for (const col of expenseTypeColumns) {
      totalsRow[col.label] = (t.totalsByType ?? {})[col.type] ?? 0;
    }
    totalsRow["Total gastos"] = t.totalExpenses;
    totalsRow["% ejec. (peor partida)"] =
      displayedRows.length > 0 ? `${(t.avgUsagePct * 100).toFixed(1)}%` : "";
    totalsRow["Semáforo peor partida"] = "";
    totalsRow["Disponible / variación"] = displayedRows.reduce((s, r) => s + r.remaining, 0);

    exportData.push(totalsRow);

    exportData.push({
      "N° Licitación": "BALANCE GENERAL",
      Cliente: "",
      "Facturación mensual": t.totalBilling,
      "Total gastos": t.totalSpendAll,
      "Disponible / variación": t.budgetVariance,
      Gasto:
        partida === "ALL"
          ? `Presupuesto MO+Ins+Adm+Util: ${t.totalOperatingBudget}`
          : `Presupuesto partida: ${t.totalOperatingBudget}`,
      Presupuesto:
        t.generalBalance >= 0
          ? `Positivo · ${t.generalBalance}`
          : `Negativo · ${Math.abs(t.generalBalance)}`,
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rentabilidad");
    const suffix = partida === "ALL" ? "todas-partidas" : selectedPartida.toLowerCase();
    XLSX.writeFile(wb, `reporte-mensual-${selectedMonth}-${suffix}.xlsx`);
  }


  /** Gasto real + presupuesto + semáforo de ejecución por rubro */
  function RubroSpendBudgetCell({
    budget,
    billing,
    rubro,
    onSpendClick,
  }: {
    budget: number;
    billing: number;
    rubro: RubroTrafficSnapshot;
    onSpendClick?: () => void;
  }) {
    const budgetPct = billing > 0 ? (budget / billing) * 100 : 0;
    const spendClickable = rubro.spend > 0 && onSpendClick;
    return (
      <div className="text-right tabular-nums leading-tight space-y-0.5 min-w-[7.5rem]">
        <div className="flex justify-end">
          <TrafficLightBadge light={rubro.trafficLight} pct={rubro.usagePctFormatted} size="sm" />
        </div>
        {spendClickable ? (
          <button
            type="button"
            onClick={onSpendClick}
            className="font-semibold text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 cursor-pointer"
            title="Ver desglose de este gasto"
          >
            {formatCurrency(rubro.spend)}
          </button>
        ) : (
          <div className="font-semibold text-slate-800">
            {rubro.spend > 0 ? formatCurrency(rubro.spend) : "—"}
          </div>
        )}
        {(rubro.cargasSocialesSpend ?? 0) > 0 && (
          <div className="text-[10px] text-amber-700 font-medium">
            Cargas soc.: {formatCurrency(rubro.cargasSocialesSpend!)}
          </div>
        )}
        <div className="text-[10px] text-slate-500">P: {formatCurrency(budget)}</div>
        <div className="text-[10px] text-slate-400">{budgetPct.toFixed(1)}% fact.</div>
      </div>
    );
  }

  /** Partida única: gasto + presupuesto + % ejecución */
  function PartidaSpendBudgetCell({
    spend,
    budget,
    pctOfBilling,
    usagePctFormatted,
    trafficLight,
    onSpendClick,
  }: {
    spend: number;
    budget: number;
    pctOfBilling: number;
    usagePctFormatted: number;
    trafficLight: TrafficLight;
    onSpendClick?: () => void;
  }) {
    const spendClickable = spend > 0 && onSpendClick;
    return (
      <div className="text-right tabular-nums leading-tight space-y-0.5 min-w-[7.5rem]">
        <div className="flex justify-end">
          <TrafficLightBadge light={trafficLight} pct={usagePctFormatted} size="sm" />
        </div>
        {spendClickable ? (
          <button
            type="button"
            onClick={onSpendClick}
            className="font-semibold text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 cursor-pointer"
            title="Ver desglose de este gasto"
          >
            {formatCurrency(spend)}
          </button>
        ) : (
          <div className="font-semibold text-slate-800">
            {spend > 0 ? formatCurrency(spend) : "—"}
          </div>
        )}
        <div className="text-[10px] text-slate-500">P: {formatCurrency(budget)}</div>
        <div className="text-[10px] text-slate-400">{(pctOfBilling * 100).toFixed(1)}% fact.</div>
      </div>
    );
  }

  function RubroTotalsCell({
    spend,
    budget,
    billing,
    cargasSocialesSpend,
    onSpendClick,
  }: {
    spend: number;
    budget: number;
    billing: number;
    cargasSocialesSpend?: number;
    onSpendClick?: () => void;
  }) {
    const budgetPct = billing > 0 ? (budget / billing) * 100 : 0;
    const spendClickable = spend > 0 && onSpendClick;
    return (
      <div className="text-right tabular-nums leading-tight space-y-0.5">
        {spendClickable ? (
          <button
            type="button"
            onClick={onSpendClick}
            className="font-semibold text-blue-700 hover:text-blue-900 hover:underline underline-offset-2 cursor-pointer"
            title="Ver desglose consolidado de este gasto"
          >
            {formatCurrency(spend)}
          </button>
        ) : (
          <div className="font-semibold">{formatCurrency(spend)}</div>
        )}
        {(cargasSocialesSpend ?? 0) > 0 && (
          <div className="text-[10px] text-amber-700 font-medium">
            Cargas soc.: {formatCurrency(cargasSocialesSpend!)}
          </div>
        )}
        <div className="text-[10px] text-slate-500 font-normal">P: {formatCurrency(budget)}</div>
        <div className="text-[10px] text-slate-400 font-normal">{budgetPct.toFixed(1)}% fact.</div>
      </div>
    );
  }

  function partidaRubro(r: ProfitabilityRow): RubroTrafficSnapshot {
    if (selectedPartida === "LABOR") return r.rubroTraffic.LABOR;
    if (selectedPartida === "SUPPLIES") return r.rubroTraffic.SUPPLIES;
    return r.rubroTraffic.ADMIN;
  }

  function partidaRubroKey(): RubroSpendDrilldownRubro {
    if (selectedPartida === "LABOR") return "LABOR";
    if (selectedPartida === "SUPPLIES") return "SUPPLIES";
    return "ADMIN";
  }

  return (
    <>
      <Topbar title="Reporte mensual de rentabilidad" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Reporte mensual</h2>
            <p className="text-sm text-slate-500">
              {displayedRows.length}
              {hasActiveColumnFilters(columnFilters) && displayedRows.length !== rows.length
                ? ` de ${rows.length}`
                : ""}{" "}
              contratos analizados · {partidaLabel}
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={exportToExcel}>
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
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
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Select value={selectedPartida} onValueChange={(v) => setSelectedPartida(v as ReportPartidaFilter)}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Partida" /></SelectTrigger>
            <SelectContent>
              {REPORT_PARTIDA_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {report && (
          partida === "ALL" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Facturación total" value={formatCurrency(displayTotals.totalBilling)} icon={DollarSign} color="blue" />
                <MetricCard
                  title="Gasto mano de obra"
                  value={formatCurrency(displayTotals.totalLaborSpend)}
                  subtitle={
                    displayTotals.totalLaborCargasSpend > 0
                      ? `Cargas soc. ${formatCurrency(displayTotals.totalLaborCargasSpend)} · P. ${formatCurrency(displayTotals.totalLaborBudget)}`
                      : `Presupuesto ${formatCurrency(displayTotals.totalLaborBudget)}`
                  }
                  icon={TrendingUp}
                  color="purple"
                />
                <MetricCard title="Gasto insumos" value={formatCurrency(displayTotals.totalSuppliesSpend)} subtitle={`Presupuesto ${formatCurrency(displayTotals.totalSuppliesBudget)}`} icon={TrendingUp} color="purple" />
                <MetricCard title="Gasto administrativo" value={formatCurrency(displayTotals.totalAdminSpend)} subtitle={`Presupuesto ${formatCurrency(displayTotals.totalAdminBudget)}`} icon={TrendingUp} color="purple" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Gasto utilidad" value={formatCurrency(displayTotals.totalProfitSpend)} subtitle={`Presupuesto ${formatCurrency(displayTotals.totalProfitBudget)}`} icon={FileText} color="green" />
                <MetricCard title="Total gastos (todas las fuentes)" value={formatCurrency(displayTotals.totalExpenses)} subtitle={`${(displayTotals.avgUsagePct * 100).toFixed(1)}% ejecución máx. entre partidas`} icon={TrendingUp} color="purple" />
                <MetricCard title="Contratos en riesgo" value={String(trafficCounts.RED)} subtitle={`${trafficCounts.YELLOW} en precaución`} icon={AlertTriangle} color="red" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Facturación total" value={formatCurrency(displayTotals.totalBilling)} icon={DollarSign} color="blue" />
              <MetricCard title={`Gasto (${partidaLabel})`} value={formatCurrency(displayTotals.totalExpenses)} subtitle={`Presupuesto ${formatCurrency(displayTotals.totalReportBudget)}`} icon={TrendingUp} color="purple" />
              <MetricCard title="% ejecución promedio" value={`${(displayTotals.avgUsagePct * 100).toFixed(1)}%`} icon={FileText} color="green" />
              <MetricCard title="Contratos en riesgo" value={String(trafficCounts.RED)} subtitle={`${trafficCounts.YELLOW} en precaución`} icon={AlertTriangle} color="red" />
            </div>
          )
        )}

        <div className="grid grid-cols-3 gap-4">
          {(["GREEN", "YELLOW", "RED"] as TrafficLight[]).map((tl) => {
            const count = trafficCounts[tl];
            const pct = displayedRows.length > 0 ? (count / displayedRows.length) * 100 : 0;
            const colors = { GREEN: "border-green-200 bg-green-50", YELLOW: "border-yellow-200 bg-yellow-50", RED: "border-red-200 bg-red-50" };
            const labels = { GREEN: "Normal (<80%)", YELLOW: "Precaución (80–100%)", RED: "Crítico (>100%)" };
            const dotColors = { GREEN: "bg-green-500", YELLOW: "bg-yellow-500", RED: "bg-red-500" };
            return (
              <Card key={tl} className={`border-2 ${colors[tl]}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-full ${dotColors[tl]} flex items-center justify-center text-white text-lg font-bold`}>
                    {count}
                  </div>
                  <div>
                    <div className="font-semibold">{labels[tl]}</div>
                    <div className="text-sm text-slate-500">{pct.toFixed(0)}% del total</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Detalle por contrato
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">Cargando reporte...</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No hay datos para mostrar</div>
            ) : (
              <div className="max-h-[calc(100vh-14rem)] overflow-auto overscroll-contain">
                <table data-table-id="gastos-reports-profitability" className="w-full text-xs">
                  <thead>
                    <TableColumnFilterHead
                      tableId="gastos-reports-profitability"
                      defaultColumnWidths={{
                        licitacion: 120,
                        cliente: 200,
                        empresa: 140,
                        facturacion: 110,
                        mo: 90,
                        insumos: 90,
                        adm: 90,
                        util: 90,
                        presupuesto: 110,
                        total: 110,
                        peor: 100,
                      }}
                      columns={columnDefs}
                      rows={rows}
                      filters={columnFilters}
                      onFilterChange={onColumnFilterChange}
                    />
                  </thead>
                  <tbody className="divide-y">
                    {displayedRows.map((r) => (
                      <tr key={r.contractId} className="hover:bg-muted/50">
                        <td className="px-3 py-2">
                          <Link
                            href={`/contracts/${r.contractId}`}
                            className="font-medium text-red-600 hover:underline"
                          >
                            {r.licitacionNo}
                          </Link>
                        </td>
                        <td className="px-3 py-2 max-w-36">
                          <div className="truncate">{r.client}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">{companyDisplayName(r.company, companyRows)}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right">{formatCurrency(r.monthlyBilling)}</td>
                        {partida === "ALL" ? (
                          <>
                            <td className="px-3 py-2">
                              <RubroSpendBudgetCell
                                budget={r.laborBudget}
                                billing={r.monthlyBilling}
                                rubro={r.rubroTraffic.LABOR}
                                onSpendClick={() => openRubroDrilldown(r, "LABOR")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RubroSpendBudgetCell
                                budget={r.suppliesBudget}
                                billing={r.monthlyBilling}
                                rubro={r.rubroTraffic.SUPPLIES}
                                onSpendClick={() => openRubroDrilldown(r, "SUPPLIES")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RubroSpendBudgetCell
                                budget={r.adminBudget}
                                billing={r.monthlyBilling}
                                rubro={r.rubroTraffic.ADMIN}
                                onSpendClick={() => openRubroDrilldown(r, "ADMIN")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RubroSpendBudgetCell
                                budget={r.profitBudget}
                                billing={r.monthlyBilling}
                                rubro={r.rubroTraffic.PROFIT}
                                onSpendClick={() => openRubroDrilldown(r, "PROFIT")}
                              />
                            </td>
                          </>
                        ) : (
                          <td className="px-3 py-2">
                            <PartidaSpendBudgetCell
                              spend={r.grandTotal}
                              budget={r.reportBudget}
                              pctOfBilling={r.reportBudgetPct}
                              usagePctFormatted={r.budgetUsagePctFormatted}
                              trafficLight={partidaRubro(r).trafficLight}
                              onSpendClick={() => openRubroDrilldown(r, partidaRubroKey())}
                            />
                          </td>
                        )}
                        {expenseTypeColumns.map((col) => {
                          const v = r.expensesByTypeMerged[col.type] ?? 0;
                          return (
                            <td key={col.type} className="px-3 py-2 text-right tabular-nums">
                              {v > 0 ? formatCurrency(v) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-semibold">{r.grandTotal > 0 ? formatCurrency(r.grandTotal) : "—"}</td>
                        <td className="px-3 py-2" title="Mayor % de ejecución entre M.O., insumos, administrativo y utilidad">
                          <TrafficLightBadge light={r.trafficLight} pct={r.budgetUsagePctFormatted} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {displayedRows.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 bg-muted/50 font-bold">
                        <td colSpan={3} className="px-3 py-2 text-right">TOTALES:</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(displayTotals.totalBilling)}</td>
                        {partida === "ALL" ? (
                          <>
                            <td className="px-3 py-2">
                              <RubroTotalsCell
                                spend={displayTotals.totalLaborSpend}
                                budget={displayTotals.totalLaborBudget}
                                billing={displayTotals.totalBilling}
                                cargasSocialesSpend={displayTotals.totalLaborCargasSpend}
                                onSpendClick={() => openConsolidatedRubroDrilldown("LABOR")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RubroTotalsCell
                                spend={displayTotals.totalSuppliesSpend}
                                budget={displayTotals.totalSuppliesBudget}
                                billing={displayTotals.totalBilling}
                                onSpendClick={() => openConsolidatedRubroDrilldown("SUPPLIES")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RubroTotalsCell
                                spend={displayTotals.totalAdminSpend}
                                budget={displayTotals.totalAdminBudget}
                                billing={displayTotals.totalBilling}
                                onSpendClick={() => openConsolidatedRubroDrilldown("ADMIN")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <RubroTotalsCell
                                spend={displayTotals.totalProfitSpend}
                                budget={displayTotals.totalProfitBudget}
                                billing={displayTotals.totalBilling}
                                onSpendClick={() => openConsolidatedRubroDrilldown("PROFIT")}
                              />
                            </td>
                          </>
                        ) : (
                          <td className="px-3 py-2">
                            <RubroTotalsCell
                              spend={displayTotals.totalExpenses}
                              budget={displayTotals.totalReportBudget}
                              billing={displayTotals.totalBilling}
                              onSpendClick={() => openConsolidatedRubroDrilldown(partidaRubroKey())}
                            />
                          </td>
                        )}
                        {expenseTypeColumns.map((col) => (
                          <td key={col.type} className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency((displayTotals.totalsByType ?? {})[col.type] ?? 0)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right">{formatCurrency(displayTotals.totalExpenses)}</td>
                        <td className="px-3 py-2" />
                      </tr>
                      <tr className="border-t bg-slate-100/90">
                        <td colSpan={4} className="px-3 py-3 align-top text-sm font-semibold text-slate-800">
                          Gasto consolidado del mes
                          <p className="mt-0.5 text-xs font-normal text-slate-500">
                            {displayedRows.length} contrato{displayedRows.length === 1 ? "" : "s"} · suma de todos
                          </p>
                        </td>
                        <td colSpan={tableColCount - 4} className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                            {partida === "ALL" ? (
                              <>
                                <span className="tabular-nums whitespace-nowrap">
                                  <span className="text-slate-600">Mano de obra:</span>{" "}
                                  <span className="font-semibold text-slate-900">
                                    {formatCurrency(displayTotals.totalLaborSpend)}
                                  </span>
                                  {displayTotals.totalLaborCargasSpend > 0 && (
                                    <span className="text-amber-700 ml-1 text-xs font-medium">
                                      (Cargas soc.: {formatCurrency(displayTotals.totalLaborCargasSpend)})
                                    </span>
                                  )}
                                  {displayTotals.totalLaborBudget > 0 && (
                                    <span className="text-slate-500 ml-1">
                                      ({spendUsagePct(
                                        displayTotals.totalLaborSpend,
                                        displayTotals.totalLaborBudget
                                      )}{" "}
                                      del P.)
                                    </span>
                                  )}
                                </span>
                                <ConsolidatedSpendChip
                                  label="Insumos"
                                  spend={displayTotals.totalSuppliesSpend}
                                  budget={displayTotals.totalSuppliesBudget}
                                />
                                <ConsolidatedSpendChip
                                  label="Administrativo"
                                  spend={displayTotals.totalAdminSpend}
                                  budget={displayTotals.totalAdminBudget}
                                />
                                <ConsolidatedSpendChip
                                  label="Utilidad"
                                  spend={displayTotals.totalProfitSpend}
                                  budget={displayTotals.totalProfitBudget}
                                />
                              </>
                            ) : (
                              <ConsolidatedSpendChip
                                label={partidaLabel}
                                spend={displayTotals.totalExpenses}
                                budget={displayTotals.totalReportBudget}
                              />
                            )}
                            <span className="border-l border-slate-300 pl-4 tabular-nums whitespace-nowrap">
                              <span className="text-slate-600">Total gastos:</span>{" "}
                              <span className="font-bold text-slate-900">
                                {formatCurrency(displayTotals.totalSpendAll)}
                              </span>
                            </span>
                          </div>
                        </td>
                      </tr>
                      <tr className="bg-slate-50/90">
                        <td colSpan={4} className="px-3 py-3 align-top text-sm font-semibold text-slate-800">
                          ¿En qué se gastó?
                          <p className="mt-0.5 text-xs font-normal text-slate-500">
                            Desglose consolidado por concepto
                          </p>
                        </td>
                        <td colSpan={tableColCount - 4} className="px-3 py-3">
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                            {consolidatedExpenseEntries.map(({ type, label, amount }) => (
                              <span key={type} className="tabular-nums whitespace-nowrap">
                                <span className="text-slate-600">
                                  {label || expenseTypeLabel(type)}:
                                </span>{" "}
                                <span className="font-medium text-slate-900">{formatCurrency(amount)}</span>
                              </span>
                            ))}
                            {consolidatedExpenseEntries.length === 0 && (
                              <span className="text-slate-500">Sin gastos registrados en el mes</span>
                            )}
                          </div>
                          {partida === "ALL" && displayTotals.totalLaborSpend > 0 && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              La mano de obra incluye nómina NAF asignada por asistencia; el detalle por concepto
                              muestra los gastos registrados en el sistema (planilla, apertura, uniformes, etc.).
                            </p>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {displayedRows.length > 0 && (
                  <ReportGeneralBalanceSummary
                    totals={displayTotals}
                    partida={partida}
                    contractCount={displayedRows.length}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <RubroSpendDrilldownDialog
          open={!!rubroDrilldown}
          onOpenChange={(open) => {
            if (!open) setRubroDrilldown(null);
          }}
          target={rubroDrilldown}
        />
      </div>
    </>
  );
}
