import { getEffectiveMonthlyBilling } from "@/modules/presupuestos/business/effectiveBilling";
import { getDemandBillingForPeriod } from "@/modules/presupuestos/business/demandBilling";

export type DemandBillingRow = {
  periodYear: number;
  periodMonth: number;
  monthlyBilling: { toString(): string };
};

export function monthBounds(periodYear: number, periodMonth: number) {
  const monthStart = new Date(periodYear, periodMonth - 1, 1);
  const monthEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59, 999);
  return { monthStart, monthEnd };
}

/** Contrato con vigencia que cubre al menos un día del mes calendario. */
export function contractVigenteInMonthWhere(periodYear: number, periodMonth: number) {
  const { monthStart, monthEnd } = monthBounds(periodYear, periodMonth);
  return {
    startDate: { lte: monthEnd },
    endDate: { gte: monthStart },
  };
}

export function periodAsOfDate(periodYear: number, periodMonth: number): Date {
  return new Date(periodYear, periodMonth - 1, 15);
}

export function parseContractListPeriod(searchParams: URLSearchParams): {
  periodYear: number;
  periodMonth: number;
  usePeriodView: boolean;
} {
  const rawYear = searchParams.get("periodYear");
  const rawMonth = searchParams.get("periodMonth");
  if (rawYear == null && rawMonth == null) {
    const now = new Date();
    return {
      periodYear: now.getFullYear(),
      periodMonth: now.getMonth() + 1,
      usePeriodView: false,
    };
  }
  const periodYear = parseInt(rawYear ?? "", 10);
  const periodMonth = parseInt(rawMonth ?? "", 10);
  if (!Number.isFinite(periodYear) || !Number.isFinite(periodMonth)) {
    throw new Error("periodYear y periodMonth inválidos");
  }
  if (periodMonth < 1 || periodMonth > 12) {
    throw new Error("periodMonth debe estar entre 1 y 12");
  }
  return { periodYear, periodMonth, usePeriodView: true };
}

export function resolveContractMonthlyBilling(
  contract: {
    hiringType: string;
    monthlyBilling: { toString(): string } | number;
  },
  billingHistory: { periodMonth: Date; monthlyBilling: { toString(): string } }[],
  demandBilling: DemandBillingRow[],
  periodYear: number,
  periodMonth: number
): { billing: number | null; amountDefined: boolean } {
  if (contract.hiringType === "ON_DEMAND") {
    const amount = getDemandBillingForPeriod(demandBilling, periodYear, periodMonth);
    return { billing: amount, amountDefined: amount !== null };
  }
  const base = parseFloat(contract.monthlyBilling.toString());
  const billing = getEffectiveMonthlyBilling(
    base,
    billingHistory as { periodMonth: Date; monthlyBilling: number | string }[],
    periodAsOfDate(periodYear, periodMonth)
  );
  return { billing, amountDefined: true };
}

export type PeriodViewKind = "past" | "current" | "future";

export function periodViewKind(periodYear: number, periodMonth: number): PeriodViewKind {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  if (periodYear < cy || (periodYear === cy && periodMonth < cm)) return "past";
  if (periodYear === cy && periodMonth === cm) return "current";
  return "future";
}
