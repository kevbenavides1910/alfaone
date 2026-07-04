import type { ContractHiringType } from "@prisma/client";

/** Meses calendario (inclusive) dentro de la vigencia del contrato. */
export function monthsInContractRange(
  startDate: Date,
  endDate: Date
): { periodYear: number; periodMonth: number }[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let y = start.getFullYear();
  let m = start.getMonth() + 1;
  const endY = end.getFullYear();
  const endM = end.getMonth() + 1;
  const out: { periodYear: number; periodMonth: number }[] = [];

  while (y < endY || (y === endY && m <= endM)) {
    out.push({ periodYear: y, periodMonth: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function getDemandBillingForPeriod(
  rows: { periodYear: number; periodMonth: number; monthlyBilling: { toString(): string } }[],
  periodYear: number,
  periodMonth: number
): number | null {
  const row = rows.find((r) => r.periodYear === periodYear && r.periodMonth === periodMonth);
  if (!row) return null;
  const amount = parseFloat(row.monthlyBilling.toString());
  return amount > 0 ? amount : null;
}

export const FACTURA_CLOSED_STATUSES = ["FACTURADO", "COBRADO"] as const;

export function isFacturaAmountDefined(status: string): boolean {
  return status !== "PENDIENTE_DEFINIR";
}

export type HiringTypeCopied = ContractHiringType;
