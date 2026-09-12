import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { calcTrafficLight, type ReportPartidaFilter, type TrafficLight } from "@/lib/utils/constants";
import { effectiveSuppliesPct } from "@/modules/presupuestos/business/profitability";
import { getEffectiveMonthlyRevenue } from "@/modules/presupuestos/business/effectiveBilling";
import { applyNafLaborToRubros } from "@/modules/presupuestos/business/naf-labor-rubro";
import {
  getNafLaborCostByContractForYear,
  resolveNafLaborSpendForContractMonth,
} from "@/modules/empleados-naf/services/naf-labor-report";
import {
  isContractVigenteInMonth,
  prorateFixedMonthlyRevenue,
  yearBounds,
} from "@/modules/presupuestos/business/contractPeriodBilling";
import {
  getProfitabilityReportCache,
  setProfitabilityReportCache,
} from "@/modules/presupuestos/services/profitability-report-cache";

export interface MonthCell {
  month: number;
  monthlyBilling: number;
  /** Presupuesto de la partida activa (en ALL: suma MO+Insumos+Adm. para referencia; el detalle va en `partidaAllDetail`) */
  lineBudget: number;
  totalExpenses: number;
  surplus: number;
  hasData: boolean;
  trafficLight: TrafficLight;
  /** Desglose cuando el reporte es “todas las partidas” (semáforo y superávit vs. mensual). */
  partidaAllDetail?: {
    laborBudget: number;
    suppliesBudget: number;
    adminBudget: number;
    laborSpend: number;
    suppliesSpend: number;
    adminSpend: number;
    /** Gastos directos sin partida (budgetLine nulo); no entran en MO/Ins/Adm hasta asignarlos */
    unassignedSpend: number;
  };
}

export interface AnnualReportRow {
  contractId: string;
  licitacionNo: string;
  company: string;
  client: string;
  status: string;
  months: MonthCell[];
  annualBudget: number;
  annualExpenses: number;
  annualSurplus: number;
}

export interface AnnualReport {
  year: number;
  partida: ReportPartidaFilter;
  rows: AnnualReportRow[];
  monthlyTotals: { month: number; budget: number; expenses: number; surplus: number }[];
  grandBudget: number;
  grandExpenses: number;
  grandSurplus: number;
}

type RawRow = { contractid: string; month: number; total: string };
type RawLineRow = { contractid: string; month: number; bl: string; total: string };

function monthNum(m: number | string): number {
  const n = typeof m === "string" ? parseInt(m, 10) : m;
  return Number.isFinite(n) ? n : 0;
}

function buildMap(rows: RawRow[]): Map<string, Map<number, number>> {
  const m = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const cid = r.contractid;
    const mo = monthNum(r.month);
    if (mo < 1 || mo > 12) continue;
    const val = parseFloat(r.total);
    if (!m.has(cid)) m.set(cid, new Map());
    m.get(cid)!.set(mo, (m.get(cid)!.get(mo) ?? 0) + val);
  }
  return m;
}

/** Normaliza etiqueta de enum desde Postgres (p. ej. LABOR, "labor") */
function normalizeBudgetLineKey(bl: string | null | undefined): string {
  if (bl == null || bl === "" || bl === "NULL") return "NULL";
  return String(bl).replace(/^"|"$/g, "").trim().toUpperCase();
}

/** Map contractId → month → budgetLine key → amount */
function buildLineMap(rows: RawLineRow[]): Map<string, Map<number, Map<string, number>>> {
  const m = new Map<string, Map<number, Map<string, number>>>();
  for (const r of rows) {
    const cid = r.contractid;
    const mo = monthNum(r.month);
    if (mo < 1 || mo > 12) continue;
    const key = normalizeBudgetLineKey(r.bl);
    const val = parseFloat(r.total);
    if (!m.has(cid)) m.set(cid, new Map());
    const cm = m.get(cid)!;
    if (!cm.has(mo)) cm.set(mo, new Map());
    const lineMap = cm.get(mo)!;
    lineMap.set(key, (lineMap.get(key) ?? 0) + val);
  }
  return m;
}

function getLine(
  lineMap: Map<string, Map<number, Map<string, number>>>,
  cid: string,
  mo: number,
  line: "LABOR" | "SUPPLIES" | "ADMIN" | "PROFIT"
): number {
  return lineMap.get(cid)?.get(mo)?.get(line) ?? 0;
}

function totalsFromLineMap(
  lineMap: Map<string, Map<number, Map<string, number>>>,
): Map<string, Map<number, number>> {
  const totals = new Map<string, Map<number, number>>();
  for (const [cid, months] of lineMap) {
    const byMonth = new Map<number, number>();
    for (const [mo, lines] of months) {
      let sum = 0;
      for (const val of lines.values()) sum += val;
      byMonth.set(mo, sum);
    }
    totals.set(cid, byMonth);
  }
  return totals;
}

function projectMonthCell(cell: MonthCell, partida: ReportPartidaFilter): MonthCell {
  if (partida === "ALL" || !cell.partidaAllDetail) return cell;
  const d = cell.partidaAllDetail;
  const laborB = d.laborBudget;
  const supB = d.suppliesBudget;
  const admB = d.adminBudget;
  let lineBudget: number;
  let totalExpenses: number;
  let usage = 0;
  if (partida === "LABOR") {
    lineBudget = laborB;
    totalExpenses = d.laborSpend;
    usage = laborB > 0 ? d.laborSpend / laborB : 0;
  } else if (partida === "SUPPLIES") {
    lineBudget = supB;
    totalExpenses = d.suppliesSpend;
    usage = supB > 0 ? d.suppliesSpend / supB : 0;
  } else {
    lineBudget = admB;
    totalExpenses = d.adminSpend;
    usage = admB > 0 ? d.adminSpend / admB : 0;
  }
  return {
    ...cell,
    lineBudget,
    totalExpenses,
    surplus: lineBudget - totalExpenses,
    trafficLight: cell.hasData && lineBudget > 0 ? calcTrafficLight(usage) : "GREEN",
  };
}

/** Recalcula celdas/totales de una partida sin volver a consultar BD. */
export function projectAnnualReportPartida(
  report: AnnualReport,
  partida: ReportPartidaFilter,
): AnnualReport {
  if (partida === "ALL" || report.partida === partida) {
    return { ...report, partida };
  }
  const rows = report.rows.map((row) => {
    const months = row.months.map((cell) => projectMonthCell(cell, partida));
    return {
      ...row,
      months,
      annualBudget: months.reduce((s, m) => s + (m.hasData ? m.lineBudget : 0), 0),
      annualExpenses: months.reduce((s, m) => s + m.totalExpenses, 0),
      annualSurplus: months.reduce((s, m) => s + m.surplus, 0),
    };
  });
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    budget: rows.reduce((s, r) => s + r.months[i].lineBudget, 0),
    expenses: rows.reduce((s, r) => s + r.months[i].totalExpenses, 0),
    surplus: rows.reduce((s, r) => s + r.months[i].surplus, 0),
  }));
  return {
    ...report,
    partida,
    rows,
    monthlyTotals,
    grandBudget: rows.reduce((s, r) => s + r.annualBudget, 0),
    grandExpenses: rows.reduce((s, r) => s + r.annualExpenses, 0),
    grandSurplus: rows.reduce((s, r) => s + r.annualSurplus, 0),
  };
}

export async function getAnnualReport(
  year: number,
  companyFilter?: string,
  partida: ReportPartidaFilter = "ALL"
): Promise<AnnualReport> {
  const cacheKey = `annual:${year}:${companyFilter ?? "*"}`;
  const cached = getProfitabilityReportCache<AnnualReport>(cacheKey);
  if (cached) return projectAnnualReportPartida(cached, partida);

  const { yearStart, yearEnd } = yearBounds(year);
  const rangeStart = new Date(Date.UTC(year, 0, 1));
  const rangeEndExclusive = new Date(Date.UTC(year + 1, 0, 1));
  const where: Record<string, unknown> = {
    deletedAt: null,
    startDate: { lte: yearEnd },
    endDate: { gte: yearStart },
  };
  if (companyFilter) where.company = companyFilter;
  const contracts = await prisma.contract.findMany({
    where,
    orderBy: [{ company: "asc" }, { client: "asc" }],
    select: {
      id: true,
      licitacionNo: true,
      company: true,
      client: true,
      status: true,
      startDate: true,
      endDate: true,
      monthlyBilling: true,
      hiringType: true,
      laborPct: true,
      adminPct: true,
      suppliesPct: true,
      suppliesBudgetPct: true,
    },
  });
  const ids = contracts.map((c) => c.id);
  if (ids.length === 0) {
    return { year, partida, rows: [], monthlyTotals: [], grandBudget: 0, grandExpenses: 0, grandSurplus: 0 };
  }

  const [
    uniforms,
    audits,
    deferred,
    admin,
    directByLine,
    distByLine,
    billingHistRows,
    specialServicesRows,
    nafLabor,
  ] = await Promise.all([
    prisma.$queryRaw<RawRow[]>`
      SELECT "contractId" as contractid, EXTRACT(MONTH FROM "periodMonth")::int AS month, CAST(SUM("totalCost") AS TEXT) AS total
      FROM uniform_expenses
      WHERE "periodMonth" >= ${rangeStart} AND "periodMonth" < ${rangeEndExclusive}
        AND "contractId" IN (${Prisma.join(ids)})
      GROUP BY 1, 2`,

    prisma.$queryRaw<RawRow[]>`
      SELECT "contractId" as contractid, EXTRACT(MONTH FROM "findingDate")::int AS month, CAST(SUM("totalCost") AS TEXT) AS total
      FROM audit_findings
      WHERE "findingDate" >= ${rangeStart} AND "findingDate" < ${rangeEndExclusive}
        AND "contractId" IN (${Prisma.join(ids)}) AND status = 'PENDING'
      GROUP BY 1, 2`,

    prisma.$queryRaw<RawRow[]>`
      SELECT dd."contractId" as contractid, EXTRACT(MONTH FROM de."periodMonth")::int AS month, CAST(SUM(dd."allocatedAmount") AS TEXT) AS total
      FROM deferred_distributions dd
      JOIN deferred_expenses de ON de.id = dd."deferredExpenseId"
      WHERE de."periodMonth" >= ${rangeStart} AND de."periodMonth" < ${rangeEndExclusive}
        AND dd."contractId" IN (${Prisma.join(ids)})
      GROUP BY 1, 2`,

    prisma.$queryRaw<RawRow[]>`
      SELECT ad."contractId" as contractid, EXTRACT(MONTH FROM ae."periodMonth")::int AS month, CAST(SUM(ad."allocatedAmount") AS TEXT) AS total
      FROM admin_distributions ad
      JOIN admin_expenses ae ON ae.id = ad."adminExpenseId"
      WHERE ae."periodMonth" >= ${rangeStart} AND ae."periodMonth" < ${rangeEndExclusive}
        AND ad."contractId" IN (${Prisma.join(ids)})
      GROUP BY 1, 2`,

    prisma.$queryRaw<RawLineRow[]>`
      SELECT "contractId" as contractid, EXTRACT(MONTH FROM "periodMonth")::int AS month,
        COALESCE("budgetLine"::text, 'NULL') AS bl,
        CAST(SUM(amount) AS TEXT) AS total
      FROM expenses
      WHERE "periodMonth" >= ${rangeStart} AND "periodMonth" < ${rangeEndExclusive}
        AND "contractId" IN (${Prisma.join(ids)}) AND "isDeferred" = false
      GROUP BY 1, 2, 3`,

    prisma.$queryRaw<RawLineRow[]>`
      SELECT ed."contractId" as contractid, EXTRACT(MONTH FROM e."periodMonth")::int AS month,
        COALESCE(e."budgetLine"::text, 'NULL') AS bl,
        CAST(SUM(ed."allocatedAmount") AS TEXT) AS total
      FROM expense_distributions ed
      JOIN expenses e ON e.id = ed."expenseId"
      WHERE e."periodMonth" >= ${rangeStart} AND e."periodMonth" < ${rangeEndExclusive}
        AND ed."contractId" IN (${Prisma.join(ids)})
      GROUP BY 1, 2, 3`,

    prisma.billingHistory.findMany({
      where: { contractId: { in: ids } },
      select: { contractId: true, periodMonth: true, monthlyBilling: true },
      orderBy: { periodMonth: "asc" },
    }),
    prisma.contractSpecialService.findMany({
      where: {
        contractId: { in: ids },
        periodMonth: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      select: { contractId: true, periodMonth: true, amount: true },
    }),
    getNafLaborCostByContractForYear(year, companyFilter),
  ]);

  const uniformsMap = buildMap(uniforms);
  const auditsMap = buildMap(audits);
  const deferredMap = buildMap(deferred);
  const adminMap = buildMap(admin);
  const directLineMap = buildLineMap(directByLine);
  const distLineMap = buildLineMap(distByLine);
  const directMap = totalsFromLineMap(directLineMap);
  const expDistMap = totalsFromLineMap(distLineMap);

  const { hasNominaData, byContractMonth } = nafLabor;

  const billingHistoryByContract = new Map<
    string,
    { periodMonth: Date; monthlyBilling: (typeof billingHistRows)[number]["monthlyBilling"] }[]
  >();
  for (const h of billingHistRows) {
    if (!billingHistoryByContract.has(h.contractId)) {
      billingHistoryByContract.set(h.contractId, []);
    }
    billingHistoryByContract.get(h.contractId)!.push({
      periodMonth: h.periodMonth,
      monthlyBilling: h.monthlyBilling,
    });
  }

  const specialServicesByContract = new Map<
    string,
    { periodMonth: Date; amount: (typeof specialServicesRows)[number]["amount"] }[]
  >();
  for (const row of specialServicesRows) {
    const list = specialServicesByContract.get(row.contractId);
    if (list) list.push({ periodMonth: row.periodMonth, amount: row.amount });
    else specialServicesByContract.set(row.contractId, [{ periodMonth: row.periodMonth, amount: row.amount }]);
  }

  const rows: AnnualReportRow[] = contracts.map((c) => {
    const defaultBilling = parseFloat(c.monthlyBilling.toString());
    const supPctEff = effectiveSuppliesPct(c);
    const laborPct = parseFloat(c.laborPct.toString());
    const adminPct = parseFloat(c.adminPct.toString());

    const contractStart = new Date(c.startDate);
    const contractEnd = new Date(c.endDate);

    const billingHistForContract = billingHistoryByContract.get(c.id) ?? [];
    const specialServicesForContract = specialServicesByContract.get(c.id) ?? [];

    const months: MonthCell[] = Array.from({ length: 12 }, (_, i) => {
      const mo = i + 1;
      const monthStart = new Date(year, i, 15);
      const contractActive = isContractVigenteInMonth(contractStart, contractEnd, year, mo);

      const revenue = getEffectiveMonthlyRevenue(
        defaultBilling,
        billingHistForContract,
        specialServicesForContract,
        monthStart,
      );
      const billing = contractActive
        ? c.hiringType === "ON_DEMAND"
          ? revenue.billing
          : prorateFixedMonthlyRevenue(
              revenue.baseBilling,
              revenue.specialServicesTotal,
              contractStart,
              contractEnd,
              year,
              mo,
            ).billing
        : 0;

      const uniformsM = uniformsMap.get(c.id)?.get(mo) ?? 0;
      const auditM = auditsMap.get(c.id)?.get(mo) ?? 0;
      const deferredM = deferredMap.get(c.id)?.get(mo) ?? 0;
      const adminM = adminMap.get(c.id)?.get(mo) ?? 0;

      const laborU = getLine(directLineMap, c.id, mo, "LABOR") + getLine(distLineMap, c.id, mo, "LABOR");
      const supU = getLine(directLineMap, c.id, mo, "SUPPLIES") + getLine(distLineMap, c.id, mo, "SUPPLIES");
      const admU = getLine(directLineMap, c.id, mo, "ADMIN") + getLine(distLineMap, c.id, mo, "ADMIN");
      const unassignedU =
        (directLineMap.get(c.id)?.get(mo)?.get("NULL") ?? 0) +
        (distLineMap.get(c.id)?.get(mo)?.get("NULL") ?? 0);

      const manualLaborSpend = laborU;
      const suppliesSpendTotal = supU + uniformsM + deferredM;
      const adminSpendBase = admU + auditM + adminM;
      const nafLaborSpend = resolveNafLaborSpendForContractMonth(
        byContractMonth,
        hasNominaData,
        c.id,
        mo,
      );
      const { laborSpend, adminSpend: adminSpendTotal } = applyNafLaborToRubros(
        c,
        nafLaborSpend,
        manualLaborSpend,
        adminSpendBase,
      );

      const totalExpenses =
        (directMap.get(c.id)?.get(mo) ?? 0) +
        (expDistMap.get(c.id)?.get(mo) ?? 0) +
        uniformsM +
        auditM +
        deferredM +
        adminM;

      const laborB = contractActive ? billing * laborPct : 0;
      const supB = contractActive ? billing * supPctEff : 0;
      const admB = contractActive ? billing * adminPct : 0;

      const hasData = contractActive || totalExpenses > 0;

      const lineBudget = laborB + supB + admB;
      const surplus = lineBudget - totalExpenses;
      const maxUsage = Math.max(
        laborB > 0 ? laborSpend / laborB : 0,
        supB > 0 ? suppliesSpendTotal / supB : 0,
        admB > 0 ? adminSpendTotal / admB : 0
      );
      const trafficLight =
        hasData && (laborB > 0 || supB > 0 || admB > 0)
          ? calcTrafficLight(maxUsage)
          : "GREEN";

      return {
        month: mo,
        monthlyBilling: contractActive ? billing : 0,
        lineBudget,
        totalExpenses,
        surplus,
        hasData,
        trafficLight,
        partidaAllDetail: {
          laborBudget: laborB,
          suppliesBudget: supB,
          adminBudget: admB,
          laborSpend,
          suppliesSpend: suppliesSpendTotal,
          adminSpend: adminSpendTotal,
          unassignedSpend: unassignedU,
        },
      };
    });

    const annualBudget = months.reduce((s, m) => s + (m.hasData ? m.lineBudget : 0), 0);
    const annualExpenses = months.reduce((s, m) => s + m.totalExpenses, 0);
    const annualSurplus = months.reduce((s, m) => s + m.surplus, 0);
    return {
      contractId: c.id,
      licitacionNo: c.licitacionNo,
      company: c.company,
      client: c.client,
      status: c.status,
      months,
      annualBudget,
      annualExpenses,
      annualSurplus,
    };
  });

  const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
    const mo = i + 1;
    return {
      month: mo,
      budget: rows.reduce((s, r) => s + r.months[i].lineBudget, 0),
      expenses: rows.reduce((s, r) => s + r.months[i].totalExpenses, 0),
      surplus: rows.reduce((s, r) => s + r.months[i].surplus, 0),
    };
  });

  const fullReport: AnnualReport = {
    year,
    partida: "ALL",
    rows,
    monthlyTotals,
    grandBudget: rows.reduce((s, r) => s + r.annualBudget, 0),
    grandExpenses: rows.reduce((s, r) => s + r.annualExpenses, 0),
    grandSurplus: rows.reduce((s, r) => s + r.annualSurplus, 0),
  };
  setProfitabilityReportCache(cacheKey, fullReport);
  return projectAnnualReportPartida(fullReport, partida);
}
