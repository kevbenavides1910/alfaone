import type { Contract } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import type { GlobalPartidaTotals } from "@/modules/presupuestos/business/equivalence";
import { getEffectiveMonthlyBilling } from "@/modules/presupuestos/business/effectiveBilling";
import {
  resolveContractMonthlyBilling,
  type DemandBillingRow,
} from "@/modules/presupuestos/business/contractPeriodBilling";
import { calcSuppliesBudget, effectiveSuppliesPct } from "@/modules/presupuestos/business/profitability";

type HistoryRow = {
  contractId: string;
  periodMonth: Date;
  monthlyBilling: Decimal | number | string;
};

export type EnrichContractsListOptions = {
  periodYear?: number;
  periodMonth?: number;
  demandByContractId?: Map<string, DemandBillingRow[]>;
};

/**
 * Enriquece contratos para listado: facturación efectiva, presupuesto por partida (M.O., insumos, adm., utilidad)
 * y participación global por partida (facturación, M.O., insumos, adm., util.) frente al total activo.
 */
export function enrichContractsListRows(
  contracts: Contract[],
  pageHistory: HistoryRow[],
  globalTotals: GlobalPartidaTotals,
  asOfOrOptions: Date | EnrichContractsListOptions = new Date()
) {
  const options: EnrichContractsListOptions =
    asOfOrOptions instanceof Date ? {} : asOfOrOptions;
  const asOf = asOfOrOptions instanceof Date ? asOfOrOptions : new Date();
  const { periodYear, periodMonth, demandByContractId = new Map() } = options;
  const usePeriodView = periodYear != null && periodMonth != null;

  const histByContract = new Map<string, HistoryRow[]>();
  for (const h of pageHistory) {
    const arr = histByContract.get(h.contractId) ?? [];
    arr.push(h);
    histByContract.set(h.contractId, arr);
  }

  return contracts.map((c) => {
    const baseBilling = parseFloat(c.monthlyBilling.toString());
    const hist = histByContract.get(c.id) ?? [];
    let billing: number | null;
    let amountDefined: boolean;

    if (usePeriodView) {
      const resolved = resolveContractMonthlyBilling(
        c,
        hist,
        demandByContractId.get(c.id) ?? [],
        periodYear!,
        periodMonth!
      );
      billing = resolved.billing;
      amountDefined = resolved.amountDefined;
    } else {
      billing = getEffectiveMonthlyBilling(baseBilling, hist, asOf);
      amountDefined = true;
    }

    const billingAmount = billing ?? 0;
    const suppliesPctEff = effectiveSuppliesPct(c);
    const laborPct = parseFloat(c.laborPct.toString());
    const adminPct = parseFloat(c.adminPct.toString());
    const profitPct = parseFloat(c.profitPct.toString());
    const suppliesBudget = amountDefined ? calcSuppliesBudget(billingAmount, suppliesPctEff) : null;
    const laborBudget = amountDefined ? billingAmount * laborPct : null;
    const adminBudget = amountDefined ? billingAmount * adminPct : null;
    const profitBudget = amountDefined ? billingAmount * profitPct : null;

    const billingSharePct =
      amountDefined && globalTotals.totalBilling > 0
        ? billingAmount / globalTotals.totalBilling
        : 0;
    const laborSharePct =
      amountDefined && laborBudget != null && globalTotals.totalLabor > 0
        ? laborBudget / globalTotals.totalLabor
        : 0;
    const suppliesSharePct =
      amountDefined && suppliesBudget != null && globalTotals.totalSupplies > 0
        ? suppliesBudget / globalTotals.totalSupplies
        : 0;
    const adminSharePct =
      amountDefined && adminBudget != null && globalTotals.totalAdmin > 0
        ? adminBudget / globalTotals.totalAdmin
        : 0;
    const profitSharePct =
      amountDefined && profitBudget != null && globalTotals.totalProfit > 0
        ? profitBudget / globalTotals.totalProfit
        : 0;

    return {
      ...c,
      monthlyBilling: billing,
      amountDefined,
      suppliesBudgetPct: suppliesPctEff,
      laborPct,
      adminPct,
      profitPct,
      laborBudget,
      suppliesBudget,
      adminBudget,
      profitBudget,
      equivalencePct: parseFloat(c.equivalencePct.toString()),
      billingSharePct,
      laborSharePct,
      suppliesSharePct,
      adminSharePct,
      profitSharePct,
    };
  });
}
