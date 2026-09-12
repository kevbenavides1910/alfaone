/**
 * Pagos de tesorería de personal (planilla, CCSS, etc.).
 * No van a semáforo ni desglose de rubros: la mano de obra sale de nómina NAF.
 */

export const TREASURY_PAYROLL_PAYMENT_SUBCATEGORIES = [
  "PLANILLA",
  "CCSS",
  "VACACIONES",
  "LIQUIDACIONES",
  "ASOCIACION",
  "EMBARGOS",
] as const;

export type TreasuryPayrollExpenseInput = {
  type: string;
  description?: string | null;
  sourcePayment?: {
    category: string | null;
    subcategory: string | null;
  } | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/** Transferencias de planilla/CCSS tipadas mal (p. ej. ADMIN) al asignar desde Pagos. */
function descriptionLooksLikeTreasuryPayroll(description: string | null | undefined): boolean {
  const d = norm(description);
  if (!d) return false;
  if (d.includes("PLANILLA") && (d.includes("TRANSF") || d.includes("DAVIVI") || d.includes("BN Y"))) {
    return true;
  }
  if (d.includes("QUINCENA") && d.includes("TRANSF")) return true;
  if (d.includes("CCSS") && (d.includes("CUOTA") || d.includes("OBRERO") || d.includes("PATRONAL"))) {
    return true;
  }
  if (d.includes("OBRERO-PATRONAL") || d.includes("OBRERO PATRONAL")) return true;
  return false;
}

export function isTreasuryPayrollExpense(row: TreasuryPayrollExpenseInput): boolean {
  if (norm(row.type) === "PLANILLA") return true;

  const category = norm(row.sourcePayment?.category);
  const subcategory = norm(row.sourcePayment?.subcategory);
  if (
    category === "PERSONAL" &&
    (TREASURY_PAYROLL_PAYMENT_SUBCATEGORIES as readonly string[]).includes(subcategory)
  ) {
    return true;
  }

  return descriptionLooksLikeTreasuryPayroll(row.description);
}
