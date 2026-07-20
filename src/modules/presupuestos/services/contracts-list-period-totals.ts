import type { Contract } from "@prisma/client";
import { getNafLaborCostByContractForMonth } from "@/modules/empleados-naf/services/naf-labor-report";
import { getProfitabilityForContracts } from "@/modules/presupuestos/business/profitability-batch";
import { mergeLegacyIntoExpenseTypeBuckets } from "@/modules/presupuestos/business/profitability";

export type ContractPeriodSpendSummary = {
  laborSpend: number;
  suppliesSpend: number;
  adminSpend: number;
  profitSpend: number;
  grandTotal: number;
  laborBudget: number;
  suppliesBudget: number;
  adminBudget: number;
  profitBudget: number;
  monthlyBilling: number;
};

export type ContractsListPeriodTotals = {
  contractCount: number;
  contractsWithAmount: number;
  billing: number;
  specialServicesTotal: number;
  budgets: {
    labor: number;
    supplies: number;
    admin: number;
    profit: number;
    combined: number;
  };
  spend: {
    labor: number;
    supplies: number;
    admin: number;
    profit: number;
    grandTotal: number;
  };
  /** Gasto agregado por tipo (incluye uniformes, auditoría, diferidos, NAF vía rubros). */
  expensesByType: Record<string, number>;
};

import { expenseTypeLabel } from "@/lib/utils/expense-type-labels";

export { expenseTypeLabel as contractsListExpenseTypeLabel };

export async function computeContractsListPeriodTotals(
  contracts: Contract[],
  periodYear: number,
  periodMonth: number,
): Promise<{
  totals: ContractsListPeriodTotals;
  byContractId: Map<string, ContractPeriodSpendSummary>;
}> {
  const periodMonthDate = new Date(periodYear, periodMonth - 1, 1);
  const byContractId = new Map<string, ContractPeriodSpendSummary>();

  const emptyTotals: ContractsListPeriodTotals = {
    contractCount: contracts.length,
    contractsWithAmount: 0,
    billing: 0,
    specialServicesTotal: 0,
    budgets: { labor: 0, supplies: 0, admin: 0, profit: 0, combined: 0 },
    spend: { labor: 0, supplies: 0, admin: 0, profit: 0, grandTotal: 0 },
    expensesByType: {},
  };

  if (contracts.length === 0) {
    return { totals: emptyTotals, byContractId };
  }

  const nafLaborMonth = await getNafLaborCostByContractForMonth(
    periodYear,
    periodMonth,
    undefined,
  );

  const profitabilityRows = await getProfitabilityForContracts(
    contracts,
    periodMonthDate,
    "ALL",
    nafLaborMonth.byContract,
    nafLaborMonth.byContractCargas,
  );

  const expensesByType: Record<string, number> = {};
  let contractsWithAmount = 0;
  let billing = 0;
  let specialServicesTotal = 0;
  let laborBudget = 0;
  let suppliesBudget = 0;
  let adminBudget = 0;
  let profitBudget = 0;
  let laborSpend = 0;
  let suppliesSpend = 0;
  let adminSpend = 0;
  let profitSpend = 0;
  let grandTotal = 0;

  for (const prof of profitabilityRows) {
    if (prof.monthlyBilling > 0) {
      contractsWithAmount += 1;
    }
    billing += prof.monthlyBilling;
    specialServicesTotal += prof.specialServicesTotal;
    laborBudget += prof.laborBudget;
    suppliesBudget += prof.suppliesBudget;
    adminBudget += prof.adminBudget;
    profitBudget += prof.profitBudget;

    laborSpend += prof.rubroTraffic.LABOR.spend;
    suppliesSpend += prof.rubroTraffic.SUPPLIES.spend;
    adminSpend += prof.rubroTraffic.ADMIN.spend;
    profitSpend += prof.rubroTraffic.PROFIT.spend;
    grandTotal += prof.grandTotalAll;

    byContractId.set(prof.contractId, {
      laborSpend: prof.rubroTraffic.LABOR.spend,
      suppliesSpend: prof.rubroTraffic.SUPPLIES.spend,
      adminSpend: prof.rubroTraffic.ADMIN.spend,
      profitSpend: prof.rubroTraffic.PROFIT.spend,
      grandTotal: prof.grandTotalAll,
      laborBudget: prof.laborBudget,
      suppliesBudget: prof.suppliesBudget,
      adminBudget: prof.adminBudget,
      profitBudget: prof.profitBudget,
      monthlyBilling: prof.monthlyBilling,
    });

    const merged = mergeLegacyIntoExpenseTypeBuckets(prof);
    for (const [type, amount] of Object.entries(merged)) {
      if (amount <= 0) continue;
      expensesByType[type] = (expensesByType[type] ?? 0) + amount;
    }
  }

  return {
    totals: {
      contractCount: contracts.length,
      contractsWithAmount,
      billing,
      specialServicesTotal,
      budgets: {
        labor: laborBudget,
        supplies: suppliesBudget,
        admin: adminBudget,
        profit: profitBudget,
        combined: laborBudget + suppliesBudget + adminBudget + profitBudget,
      },
      spend: {
        labor: laborSpend,
        supplies: suppliesSpend,
        admin: adminSpend,
        profit: profitSpend,
        grandTotal,
      },
      expensesByType,
    },
    byContractId,
  };
}
