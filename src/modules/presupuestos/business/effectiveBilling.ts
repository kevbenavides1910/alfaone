import type { Decimal } from "@prisma/client/runtime/library";

function toNum(v: Decimal | number | string | { toString(): string }): number {
  return parseFloat(v.toString());
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Billing history rows define a new monthly rate effective from the first day of
 * `periodMonth` until superseded by a later row. Returns the rate that applies on `asOf`
 * (compared by calendar month).
 */
export function getEffectiveMonthlyBilling(
  baseBilling: number,
  history: { periodMonth: Date; monthlyBilling: Decimal | number | string }[],
  asOf: Date = new Date()
): number {
  const target = monthStart(asOf).getTime();
  let bestT = -Infinity;
  let bestAmount = baseBilling;
  for (const h of history) {
    const t = monthStart(new Date(h.periodMonth)).getTime();
    if (t <= target && t > bestT) {
      bestT = t;
      bestAmount = toNum(h.monthlyBilling);
    }
  }
  return bestAmount;
}

export function sumSpecialServicesForMonth(
  rows: { periodMonth: Date; amount: { toString(): string } | number | string }[],
  asOf: Date,
): number {
  if (rows.length === 0) return 0;
  const target = monthStart(asOf).getTime();
  return rows
    .filter((row) => monthStart(new Date(row.periodMonth)).getTime() === target)
    .reduce((sum, row) => sum + toNum(row.amount), 0);
}

/** Facturación del mes = tarifa base (historial) + servicios especiales del mismo mes. */
export function getEffectiveMonthlyRevenue(
  baseBilling: number,
  history: { periodMonth: Date; monthlyBilling: Decimal | number | string }[],
  specialServices: { periodMonth: Date; amount: { toString(): string } | number | string }[],
  asOf: Date = new Date(),
): { billing: number; baseBilling: number; specialServicesTotal: number } {
  const base = getEffectiveMonthlyBilling(baseBilling, history, asOf);
  const specialServicesTotal = sumSpecialServicesForMonth(specialServices, asOf);
  return {
    baseBilling: base,
    specialServicesTotal,
    billing: base + specialServicesTotal,
  };
}
