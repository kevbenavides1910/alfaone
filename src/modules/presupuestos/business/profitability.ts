import { prisma } from "@/modules/core/db/prisma";
import { TrafficLight, type ReportPartidaFilter, calcTrafficLight } from "@/lib/utils/constants";
import type { Decimal } from "@prisma/client/runtime/library";

export type { ReportPartidaFilter } from "@/lib/utils/constants";

function toNum(v: Decimal | number | string): number {
  return parseFloat(v.toString());
}

/** % insumos: prioriza `suppliesPct` si está definido (>0), si no `suppliesBudgetPct` */
export function effectiveSuppliesPct(contract: {
  suppliesPct: Decimal | number | string;
  suppliesBudgetPct: Decimal | number | string;
}): number {
  const s = toNum(contract.suppliesPct);
  return s > 0 ? s : toNum(contract.suppliesBudgetPct);
}

/** % ejecución, semáforo y monto de gasto por rubro de presupuesto. */
export type RubroTrafficSnapshot = {
  spend: number;
  /** Cargas sociales incluidas en spend (solo MO con nómina NAF). */
  cargasSocialesSpend?: number;
  usagePct: number;
  usagePctFormatted: number;
  trafficLight: TrafficLight;
};

export interface ProfitabilityResult {
  contractId: string;
  /** Facturación del mes (base + servicios especiales). */
  monthlyBilling: number;
  /** Tarifa mensual base sin servicios especiales. */
  monthlyBillingBase: number;
  /** Monto de servicios especiales facturados en el mes. */
  specialServicesTotal: number;
  /** % usado históricamente para insumos (efectivo) */
  suppliesBudgetPct: number;
  laborBudget: number;
  suppliesBudget: number;
  adminBudget: number;
  profitBudget: number;
  reportPartida: ReportPartidaFilter;
  /** En vista filtrada: presupuesto de esa partida. En ALL: 0 (usar labor/supplies/adminBudget). */
  reportBudget: number;
  reportBudgetPct: number;
  uniformsTotal: number;
  auditTotal: number;
  deferredTotal: number;
  adminTotal: number;
  directTotal: number;
  expenseDistTotal: number;
  directByType: Record<string, number>;
  expenseDistByType: Record<string, number>;
  expensesByType: Record<string, number>;
  grandTotal: number;
  /** Gasto total del mes (todas las partidas), independiente del filtro del reporte. */
  grandTotalAll: number;
  budgetUsagePct: number;
  budgetUsagePctFormatted: number;
  remaining: number;
  trafficLight: TrafficLight;
  /** Margen (ingresos − gastos) / ingresos; solo en vista lifetime (sin mes). */
  marginPct?: number;
  marginPctFormatted?: number;
  /** Desglose por línea de presupuesto (siempre calculado con los mismos gastos vs presupuesto del período). */
  rubroTraffic: {
    LABOR: RubroTrafficSnapshot;
    SUPPLIES: RubroTrafficSnapshot;
    ADMIN: RubroTrafficSnapshot;
    PROFIT: RubroTrafficSnapshot;
  };
  isOverBudget: boolean;
  lifetime?: {
    totalBilled: number;
    totalSpecialServices: number;
    totalBudget: number;
    totalExpenses: number;
    totalMonths: number;
    surplus: number;
    laborBudget: number;
    suppliesBudget: number;
    adminBudget: number;
    profitBudget: number;
    marginPct: number;
    marginPctFormatted: number;
  };
}

export function calcSuppliesBudget(monthlyBilling: number, pct: number): number {
  return monthlyBilling * pct;
}

export { calcTrafficLight };

/**
 * Combines unified `Expense` totals by type with legacy tables (full report).
 */
export function mergeLegacyIntoExpenseTypeBuckets(prof: ProfitabilityResult): Record<string, number> {
  const m: Record<string, number> = { ...prof.expensesByType };
  m.UNIFORMS = (m.UNIFORMS ?? 0) + prof.uniformsTotal;
  m.AUDIT = (m.AUDIT ?? 0) + prof.auditTotal;
  m.ADMIN = (m.ADMIN ?? 0) + prof.adminTotal;
  if (prof.deferredTotal > 0) {
    m.DEFERRED_LEGACY = prof.deferredTotal;
  }
  return m;
}

/**
 * Merge legacy tables into expense-type columns según la partida del reporte.
 */
export function mergeLegacyForReportPartida(
  prof: ProfitabilityResult,
  partida: ReportPartidaFilter
): Record<string, number> {
  if (partida === "ALL") return mergeLegacyIntoExpenseTypeBuckets(prof);
  const m: Record<string, number> = { ...prof.expensesByType };
  if (partida === "SUPPLIES") {
    m.UNIFORMS = (m.UNIFORMS ?? 0) + prof.uniformsTotal;
    if (prof.deferredTotal > 0) m.DEFERRED_LEGACY = prof.deferredTotal;
  } else if (partida === "ADMIN") {
    m.ADMIN = (m.ADMIN ?? 0) + prof.adminTotal;
    m.AUDIT = (m.AUDIT ?? 0) + prof.auditTotal;
  }
  return m;
}

export async function getContractProfitability(
  contractId: string,
  periodMonth?: Date,
  partida: ReportPartidaFilter = "ALL",
  options?: { nafLaborSpend?: number },
): Promise<ProfitabilityResult> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
  });
  const nafMap =
    options?.nafLaborSpend != null
      ? new Map([[contractId, options.nafLaborSpend]])
      : undefined;
  const { getProfitabilityForContracts } = await import(
    "@/modules/presupuestos/business/profitability-batch"
  );
  const [result] = await getProfitabilityForContracts(
    [contract],
    periodMonth,
    partida,
    nafMap,
  );
  return result;
}

export async function getCompanyProfitabilitySummary(company?: string) {
  const whereClause = company
    ? { company, deletedAt: null as null }
    : { deletedAt: null as null };

  const contracts = await prisma.contract.findMany({ where: whereClause });
  const { getProfitabilityForContracts } = await import(
    "@/modules/presupuestos/business/profitability-batch"
  );
  const results = await getProfitabilityForContracts(contracts, undefined, "ALL");

  return {
    totalContracts: contracts.length,
    totalBilling: results.reduce((s, r) => s + r.monthlyBilling, 0),
    totalSuppliesBudget: results.reduce((s, r) => s + r.suppliesBudget, 0),
    totalExpenses: results.reduce((s, r) => s + r.grandTotal, 0),
    green: results.filter((r) => r.trafficLight === "GREEN").length,
    yellow: results.filter((r) => r.trafficLight === "YELLOW").length,
    red: results.filter((r) => r.trafficLight === "RED").length,
    overBudget: results.filter((r) => r.isOverBudget).length,
    results,
  };
}
