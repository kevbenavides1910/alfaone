/**
 * API pública del módulo presupuestos y contratos.
 */

export {
  getEffectiveMonthlyBilling,
} from "./business/effectiveBilling";
export {
  recalculateEquivalence,
  getGlobalPartidaTotals,
  getTotalSuppliesBudget,
} from "./business/equivalence";
export {
  getContractProfitability,
  mergeLegacyForReportPartida,
  calcSuppliesBudget,
  effectiveSuppliesPct,
} from "./business/profitability";
export type { RubroTrafficSnapshot } from "./business/profitability";
export {
  distributeDeferredExpense,
  distributeAdminExpense,
  previewDeferredDistribution,
} from "./business/distribution";
export { getAnnualReport } from "./business/annualProfitability";
export type { AnnualReport, MonthCell } from "./business/annualProfitability";
export { autoExpireContracts } from "./business/autoExpire";

export { buildContractListWhere } from "./services/contracts-list-where";
export { enrichContractsListRows } from "./services/contracts-list-enrichment";
export { assignableContractStatusWhereInput } from "./services/assignable-contract-where";
export { listExpensesForSession } from "./services/expenses-list";

export {
  contractCreateSchema,
  contractUpdateSchema,
  periodSchema,
} from "./validations/contract.schema";
export type { ContractCreateInput } from "./validations/contract.schema";

export {
  expenseCreateSchema,
  deferredExpenseSchema,
  adminExpenseSchema,
  uniformExpenseSchema,
  auditFindingSchema,
} from "./validations/expense.schema";
export type {
  ExpenseCreateInput,
  DeferredExpenseInput,
  AdminExpenseInput,
  UniformExpenseInput,
  AuditFindingInput,
} from "./validations/expense.schema";
