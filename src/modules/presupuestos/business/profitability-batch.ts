import type { Contract, ExpenseBudgetLine } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/modules/core/db/prisma";
import {
  TrafficLight,
  type ReportPartidaFilter,
  calcTrafficLight,
  calcMarginTrafficLight,
} from "@/lib/utils/constants";
import { getEffectiveMonthlyRevenue } from "@/modules/presupuestos/business/effectiveBilling";
import { applyNafLaborToRubros } from "@/modules/presupuestos/business/naf-labor-rubro";
import {
  calcSuppliesBudget,
  effectiveSuppliesPct,
  type ProfitabilityResult,
} from "@/modules/presupuestos/business/profitability";

type BillingHistRow = { periodMonth: Date; monthlyBilling: Decimal | number | string };
type DirectExpenseRow = {
  amount: Decimal | number | string;
  type: string;
  budgetLine: ExpenseBudgetLine | null;
};
type ExpenseDistRow = {
  allocatedAmount: { toString(): string } | number;
  expense: { type: string; budgetLine: ExpenseBudgetLine | null };
};

export type ProfitabilityBatchData = {
  billingByContract: Map<string, BillingHistRow[]>;
  uniformsByContract: Map<string, { totalCost: { toString(): string } | number }[]>;
  auditByContract: Map<string, { totalCost: { toString(): string } | number }[]>;
  deferredByContract: Map<string, { allocatedAmount: { toString(): string } | number }[]>;
  adminByContract: Map<string, { allocatedAmount: { toString(): string } | number }[]>;
  expensesByContract: Map<string, DirectExpenseRow[]>;
  expenseDistsByContract: Map<string, ExpenseDistRow[]>;
  specialServicesByContract: Map<string, { periodMonth: Date; amount: { toString(): string } | number }[]>;
};

function toNum(v: { toString(): string } | number | string): number {
  return parseFloat(v.toString());
}

function monthRange(periodMonth?: Date): { gte: Date; lte: Date } | undefined {
  if (!periodMonth) return undefined;
  const y = periodMonth.getFullYear();
  const m = periodMonth.getMonth();
  return {
    gte: new Date(y, m, 1),
    lte: new Date(y, m + 1, 0, 23, 59, 59),
  };
}

function groupByContractId<T extends { contractId: string }>(rows: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.contractId);
    if (list) list.push(row);
    else map.set(row.contractId, [row]);
  }
  return map;
}

function emptyBatch(): ProfitabilityBatchData {
  return {
    billingByContract: new Map(),
    uniformsByContract: new Map(),
    auditByContract: new Map(),
    deferredByContract: new Map(),
    adminByContract: new Map(),
    expensesByContract: new Map(),
    expenseDistsByContract: new Map(),
    specialServicesByContract: new Map(),
  };
}

function usageRatio(spend: number, budget: number): number {
  if (budget <= 0) return 0;
  return spend / budget;
}

function rubroSnapshot(spend: number, budget: number, cargasSocialesSpend?: number) {
  const ur = usageRatio(spend, budget);
  return {
    spend,
    ...(cargasSocialesSpend != null && cargasSocialesSpend > 0 ? { cargasSocialesSpend } : {}),
    usagePct: ur,
    usagePctFormatted: ur * 100,
    trafficLight: (budget > 0 ? calcTrafficLight(ur) : "GREEN") as TrafficLight,
  };
}

/** Carga gastos de todos los contratos en consultas bulk (evita N+1). */
export async function loadProfitabilityBatchData(
  contractIds: string[],
  periodMonth?: Date,
): Promise<ProfitabilityBatchData> {
  if (contractIds.length === 0) return emptyBatch();

  const range = monthRange(periodMonth);
  const idFilter = { contractId: { in: contractIds } };

  const [
    billingRows,
    uniforms,
    findings,
    deferredDists,
    adminDists,
    directExpenses,
    expenseDists,
    specialServices,
  ] = await Promise.all([
    prisma.billingHistory.findMany({
      where: idFilter,
      select: { contractId: true, periodMonth: true, monthlyBilling: true },
    }),
    prisma.uniformExpense.findMany({
      where: {
        ...idFilter,
        ...(range ? { periodMonth: { gte: range.gte, lte: range.lte } } : {}),
      },
      select: { contractId: true, totalCost: true },
    }),
    prisma.auditFinding.findMany({
      where: {
        ...idFilter,
        status: "PENDING",
        ...(range ? { findingDate: { gte: range.gte, lte: range.lte } } : {}),
      },
      select: { contractId: true, totalCost: true },
    }),
    prisma.deferredDistribution.findMany({
      where: {
        ...idFilter,
        ...(range
          ? { deferredExpense: { periodMonth: { gte: range.gte, lte: range.lte } } }
          : {}),
      },
      select: { contractId: true, allocatedAmount: true },
    }),
    prisma.adminDistribution.findMany({
      where: {
        ...idFilter,
        ...(range
          ? { adminExpense: { periodMonth: { gte: range.gte, lte: range.lte } } }
          : {}),
      },
      select: { contractId: true, allocatedAmount: true },
    }),
    prisma.expense.findMany({
      where: {
        ...idFilter,
        isDeferred: false,
        ...(range ? { periodMonth: { gte: range.gte, lte: range.lte } } : {}),
      },
      select: { contractId: true, amount: true, type: true, budgetLine: true },
    }),
    prisma.expenseDistribution.findMany({
      where: {
        ...idFilter,
        expense: {
          approvalStatus: { not: "REJECTED" },
          ...(range ? { periodMonth: { gte: range.gte, lte: range.lte } } : {}),
        },
      },
      select: {
        contractId: true,
        allocatedAmount: true,
        expense: { select: { type: true, budgetLine: true } },
      },
    }),
    prisma.contractSpecialService.findMany({
      where: {
        ...idFilter,
        ...(range ? { periodMonth: { gte: range.gte, lte: range.lte } } : {}),
      },
      select: { contractId: true, periodMonth: true, amount: true },
    }),
  ]);

  return {
    billingByContract: groupByContractId(billingRows),
    uniformsByContract: groupByContractId(uniforms),
    auditByContract: groupByContractId(findings),
    deferredByContract: groupByContractId(deferredDists),
    adminByContract: groupByContractId(adminDists),
    expensesByContract: groupByContractId(
      directExpenses.flatMap((row) =>
        row.contractId != null
          ? [{ contractId: row.contractId, amount: row.amount, type: row.type, budgetLine: row.budgetLine }]
          : [],
      ),
    ),
    expenseDistsByContract: groupByContractId(expenseDists),
    specialServicesByContract: groupByContractId(specialServices),
  };
}

export function computeContractProfitability(
  contract: Contract,
  batch: ProfitabilityBatchData,
  periodMonth: Date | undefined,
  partida: ReportPartidaFilter,
  options?: { nafLaborSpend?: number; nafLaborCargasSpend?: number },
): ProfitabilityResult {
  const contractId = contract.id;
  const billingHistRows = batch.billingByContract.get(contractId) ?? [];
  const uniforms = batch.uniformsByContract.get(contractId) ?? [];
  const findings = batch.auditByContract.get(contractId) ?? [];
  const deferredDists = batch.deferredByContract.get(contractId) ?? [];
  const adminDists = batch.adminByContract.get(contractId) ?? [];
  const directExpenses = batch.expensesByContract.get(contractId) ?? [];
  const expenseDists = batch.expenseDistsByContract.get(contractId) ?? [];

  const baseBilling = toNum(contract.monthlyBilling);
  const suppliesPctEff = effectiveSuppliesPct(contract);
  const laborPct = toNum(contract.laborPct);
  const adminPct = toNum(contract.adminPct);
  const profitPct = toNum(contract.profitPct);

  const specialServicesRows = batch.specialServicesByContract.get(contractId) ?? [];

  const asOfForRate = periodMonth ?? new Date();
  const revenue = getEffectiveMonthlyRevenue(
    baseBilling,
    billingHistRows,
    specialServicesRows,
    asOfForRate,
  );
  const billing = revenue.billing;

  const laborBudget = calcSuppliesBudget(billing, laborPct);
  const suppliesBudget = calcSuppliesBudget(billing, suppliesPctEff);
  const adminBudget = calcSuppliesBudget(billing, adminPct);
  const profitBudget = calcSuppliesBudget(billing, profitPct);

  const uniformsTotal = uniforms.reduce((s, u) => s + toNum(u.totalCost), 0);
  const auditTotal = findings.reduce((s, f) => s + toNum(f.totalCost), 0);
  const deferredTotal = deferredDists.reduce((s, d) => s + toNum(d.allocatedAmount), 0);
  const adminTotal = adminDists.reduce((s, d) => s + toNum(d.allocatedAmount), 0);

  const directByType: Record<string, number> = {};
  const directByLine: Record<ExpenseBudgetLine, number> = {
    LABOR: 0,
    SUPPLIES: 0,
    ADMIN: 0,
    PROFIT: 0,
  };
  let directUnassigned = 0;

  for (const e of directExpenses) {
    const amt = toNum(e.amount);
    if (e.budgetLine == null) {
      directUnassigned += amt;
    } else {
      directByLine[e.budgetLine] = (directByLine[e.budgetLine] ?? 0) + amt;
    }
    directByType[e.type] = (directByType[e.type] ?? 0) + amt;
  }

  const expenseDistByType: Record<string, number> = {};
  const distByLine: Record<ExpenseBudgetLine, number> = {
    LABOR: 0,
    SUPPLIES: 0,
    ADMIN: 0,
    PROFIT: 0,
  };
  let distUnassigned = 0;

  for (const d of expenseDists) {
    const amt = toNum(d.allocatedAmount);
    const bl = d.expense.budgetLine;
    if (bl == null) {
      distUnassigned += amt;
    } else {
      distByLine[bl] = (distByLine[bl] ?? 0) + amt;
    }
    const t = d.expense.type;
    expenseDistByType[t] = (expenseDistByType[t] ?? 0) + amt;
  }

  const lineSpend = (line: ExpenseBudgetLine) =>
    (directByLine[line] ?? 0) + (distByLine[line] ?? 0);

  const manualLaborSpend = lineSpend("LABOR");
  const suppliesUnifiedSpend = lineSpend("SUPPLIES");
  const adminUnifiedSpend = lineSpend("ADMIN");
  const profitSpend = lineSpend("PROFIT");

  const suppliesSpendTotal = suppliesUnifiedSpend + uniformsTotal + deferredTotal;
  const adminSpendBase = adminUnifiedSpend + adminTotal + auditTotal;
  const { laborSpend, adminSpend: adminSpendTotal } = applyNafLaborToRubros(
    contract,
    options?.nafLaborSpend,
    manualLaborSpend,
    adminSpendBase,
  );

  const directTotal = directExpenses.reduce((s, e) => s + toNum(e.amount), 0);
  const expenseDistTotal = expenseDists.reduce((s, d) => s + toNum(d.allocatedAmount), 0);

  const expensesByType: Record<string, number> = { ...directByType };
  for (const [t, v] of Object.entries(expenseDistByType)) {
    expensesByType[t] = (expensesByType[t] ?? 0) + v;
  }

  const unassignedSpend = directUnassigned + distUnassigned;
  const grandTotalAll =
    laborSpend + suppliesSpendTotal + adminSpendTotal + profitSpend + unassignedSpend;

  let grandTotal: number;
  let budgetUsagePct: number;
  let trafficLight: TrafficLight;
  let isOverBudget: boolean;
  let remaining: number;
  let reportBudget: number;
  let reportBudgetPct: number;

  let outDirectTotal = directTotal;
  let outExpenseDistTotal = expenseDistTotal;

  if (partida === "ALL") {
    grandTotal = grandTotalAll;
    const maxUsage = Math.max(
      usageRatio(laborSpend, laborBudget),
      usageRatio(suppliesSpendTotal, suppliesBudget),
      usageRatio(adminSpendTotal, adminBudget),
      usageRatio(profitSpend, profitBudget),
    );
    budgetUsagePct = maxUsage;
    trafficLight = calcTrafficLight(maxUsage);
    isOverBudget = maxUsage > 1;
    const combinedBudgetAll = laborBudget + suppliesBudget + adminBudget + profitBudget;
    remaining = combinedBudgetAll - grandTotalAll;
    reportBudget = 0;
    reportBudgetPct = 0;
  } else {
    const line = partida;
    const b =
      line === "LABOR" ? laborBudget : line === "SUPPLIES" ? suppliesBudget : adminBudget;
    const pct =
      line === "LABOR" ? laborPct : line === "SUPPLIES" ? suppliesPctEff : adminPct;
    const spend =
      line === "LABOR" ? laborSpend : line === "SUPPLIES" ? suppliesSpendTotal : adminSpendTotal;

    grandTotal = spend;
    budgetUsagePct = usageRatio(spend, b);
    trafficLight = calcTrafficLight(budgetUsagePct);
    isOverBudget = spend > b;
    remaining = b - spend;
    reportBudget = b;
    reportBudgetPct = pct;

    const dt: Record<string, number> = {};
    const edt: Record<string, number> = {};
    for (const e of directExpenses) {
      if (e.budgetLine !== line) continue;
      dt[e.type] = (dt[e.type] ?? 0) + toNum(e.amount);
    }
    for (const d of expenseDists) {
      if (d.expense.budgetLine !== line) continue;
      const t = d.expense.type;
      edt[t] = (edt[t] ?? 0) + toNum(d.allocatedAmount);
    }
    const et: Record<string, number> = { ...dt };
    for (const [t, v] of Object.entries(edt)) {
      et[t] = (et[t] ?? 0) + v;
    }
    Object.keys(directByType).forEach((k) => delete directByType[k]);
    Object.assign(directByType, dt);
    Object.keys(expenseDistByType).forEach((k) => delete expenseDistByType[k]);
    Object.assign(expenseDistByType, edt);
    Object.keys(expensesByType).forEach((k) => delete expensesByType[k]);
    Object.assign(expensesByType, et);

    outDirectTotal = Object.values(dt).reduce((s, v) => s + v, 0);
    outExpenseDistTotal = Object.values(edt).reduce((s, v) => s + v, 0);

    void directUnassigned;
    void distUnassigned;
  }

  const budgetUsagePctFormatted = budgetUsagePct * 100;

  let lifetime: ProfitabilityResult["lifetime"] = undefined;
  let marginPct: number | undefined;
  let marginPctFormatted: number | undefined;
  let rubroTraffic: ProfitabilityResult["rubroTraffic"];

  if (!periodMonth) {
    const now = new Date();
    const contractEnd = new Date(contract.endDate);
    const limitDate = contractEnd < now ? contractEnd : now;
    const startY = new Date(contract.startDate).getFullYear();
    const startM = new Date(contract.startDate).getMonth();
    const endY = limitDate.getFullYear();
    const endM = limitDate.getMonth();

    let totalBilled = 0;
    let laborBudgetAccum = 0;
    let suppliesBudgetAccum = 0;
    let adminBudgetAccum = 0;
    let profitBudgetAccum = 0;
    let totalMonths = 0;

    let y = startY;
    let m = startM;
    while (y < endY || (y === endY && m <= endM)) {
      const monthAsOf = new Date(y, m, 1);
      const monthRevenue = getEffectiveMonthlyRevenue(
        baseBilling,
        billingHistRows,
        specialServicesRows,
        monthAsOf,
      );
      totalBilled += monthRevenue.billing;
      laborBudgetAccum += monthRevenue.billing * laborPct;
      suppliesBudgetAccum += monthRevenue.billing * suppliesPctEff;
      adminBudgetAccum += monthRevenue.billing * adminPct;
      profitBudgetAccum += monthRevenue.billing * profitPct;
      totalMonths++;
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }

    const totalBudget =
      laborBudgetAccum + suppliesBudgetAccum + adminBudgetAccum + profitBudgetAccum;
    const totalSpecialServices = specialServicesRows.reduce(
      (s, row) => s + toNum(row.amount),
      0,
    );

    const computedMargin = totalBilled > 0 ? (totalBilled - grandTotalAll) / totalBilled : 0;
    marginPct = computedMargin;
    marginPctFormatted = computedMargin * 100;

    lifetime = {
      totalBilled,
      totalSpecialServices,
      totalBudget,
      totalExpenses: grandTotalAll,
      totalMonths,
      surplus: totalBudget - grandTotalAll,
      laborBudget: laborBudgetAccum,
      suppliesBudget: suppliesBudgetAccum,
      adminBudget: adminBudgetAccum,
      profitBudget: profitBudgetAccum,
      marginPct: computedMargin,
      marginPctFormatted: computedMargin * 100,
    };

    // Lifetime: semáforo y % del badge por margen; rubros vs presupuesto acumulado por partida.
    if (partida === "ALL") {
      budgetUsagePct = computedMargin;
      trafficLight = calcMarginTrafficLight(computedMargin, profitPct);
      isOverBudget = computedMargin < 0;
      remaining = totalBilled - grandTotalAll;
    } else {
      const line = partida;
      const b =
        line === "LABOR"
          ? laborBudgetAccum
          : line === "SUPPLIES"
            ? suppliesBudgetAccum
            : adminBudgetAccum;
      const spend =
        line === "LABOR"
          ? laborSpend
          : line === "SUPPLIES"
            ? suppliesSpendTotal
            : adminSpendTotal;
      budgetUsagePct = usageRatio(spend, b);
      trafficLight = calcTrafficLight(budgetUsagePct);
      isOverBudget = spend > b;
      remaining = b - spend;
      reportBudget = b;
    }

    rubroTraffic = {
      LABOR: rubroSnapshot(
        laborSpend,
        laborBudgetAccum,
        options?.nafLaborSpend != null ? (options.nafLaborCargasSpend ?? 0) : undefined,
      ),
      SUPPLIES: rubroSnapshot(suppliesSpendTotal, suppliesBudgetAccum),
      ADMIN: rubroSnapshot(adminSpendTotal, adminBudgetAccum),
      PROFIT: rubroSnapshot(profitSpend, profitBudgetAccum),
    };
  } else {
    rubroTraffic = {
      LABOR: rubroSnapshot(
        laborSpend,
        laborBudget,
        options?.nafLaborSpend != null ? (options.nafLaborCargasSpend ?? 0) : undefined,
      ),
      SUPPLIES: rubroSnapshot(suppliesSpendTotal, suppliesBudget),
      ADMIN: rubroSnapshot(adminSpendTotal, adminBudget),
      PROFIT: rubroSnapshot(profitSpend, profitBudget),
    };
  }

  return {
    contractId,
    monthlyBilling: billing,
    monthlyBillingBase: revenue.baseBilling,
    specialServicesTotal: revenue.specialServicesTotal,
    suppliesBudgetPct: suppliesPctEff,
    laborBudget,
    suppliesBudget,
    adminBudget,
    profitBudget,
    reportPartida: partida,
    reportBudget,
    reportBudgetPct,
    uniformsTotal,
    auditTotal,
    deferredTotal,
    adminTotal,
    directTotal: outDirectTotal,
    expenseDistTotal: outExpenseDistTotal,
    directByType,
    expenseDistByType,
    expensesByType,
    grandTotal,
    grandTotalAll,
    budgetUsagePct,
    budgetUsagePctFormatted: budgetUsagePct * 100,
    remaining,
    trafficLight,
    ...(marginPct != null
      ? { marginPct, marginPctFormatted }
      : {}),
    rubroTraffic,
    isOverBudget,
    lifetime,
  };
}

export async function getProfitabilityForContracts(
  contracts: Contract[],
  periodMonth: Date | undefined,
  partida: ReportPartidaFilter,
  nafLaborByContract?: Map<string, number> | null,
  nafLaborCargasByContract?: Map<string, number> | null,
): Promise<ProfitabilityResult[]> {
  if (contracts.length === 0) return [];
  const batch = await loadProfitabilityBatchData(
    contracts.map((c) => c.id),
    periodMonth,
  );
  return contracts.map((contract) =>
    computeContractProfitability(contract, batch, periodMonth, partida, {
      nafLaborSpend: nafLaborByContract?.get(contract.id),
      nafLaborCargasSpend: nafLaborCargasByContract?.get(contract.id),
    }),
  );
}
