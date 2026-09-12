import {
  getEffectiveMonthlyBilling,
  sumSpecialServicesForMonth,
} from "@/modules/presupuestos/business/effectiveBilling";
import { getDemandBillingForPeriod } from "@/modules/presupuestos/business/demandBilling";

export type SpecialServiceAmountRow = {
  periodMonth: Date;
  amount: { toString(): string } | number | string;
};

export type DemandBillingRow = {
  periodYear: number;
  periodMonth: number;
  monthlyBilling: { toString(): string };
};

/**
 * Límites del mes calendario en UTC.
 * startDate/endDate se guardan como medianoche UTC; si se usan constructores locales
 * (TZ Costa Rica UTC−6), un contrato que inicia el día 1 aparece en el mes anterior
 * (ej. Huetar Norte 2026-08-01 entra en julio).
 */
export function monthBounds(periodYear: number, periodMonth: number) {
  const monthStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
  const monthEnd = new Date(Date.UTC(periodYear, periodMonth, 0, 23, 59, 59, 999));
  return { monthStart, monthEnd };
}

export function yearBounds(year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { yearStart, yearEnd };
}

/** Contrato con vigencia que cubre al menos un día del mes calendario UTC. */
export function isContractVigenteInMonth(
  startDate: Date,
  endDate: Date,
  periodYear: number,
  periodMonth: number
): boolean {
  const { monthStart, monthEnd } = monthBounds(periodYear, periodMonth);
  return startDate <= monthEnd && endDate >= monthStart;
}

/** Contrato con vigencia que cubre al menos un día del mes calendario. */
export function contractVigenteInMonthWhere(periodYear: number, periodMonth: number) {
  const { monthStart, monthEnd } = monthBounds(periodYear, periodMonth);
  return {
    startDate: { lte: monthEnd },
    endDate: { gte: monthStart },
  };
}

export function daysInUtcMonth(periodYear: number, periodMonth: number): number {
  return new Date(Date.UTC(periodYear, periodMonth, 0)).getUTCDate();
}

export function serviceDaysCoverageInMonth(
  startDate: Date,
  endDate: Date,
  periodYear: number,
  periodMonth: number
): { serviceDays: number; daysInMonth: number; factor: number } {
  const daysInMonth = daysInUtcMonth(periodYear, periodMonth);
  if (daysInMonth <= 0) {
    return { serviceDays: 0, daysInMonth: 0, factor: 0 };
  }
  if (!isContractVigenteInMonth(startDate, endDate, periodYear, periodMonth)) {
    return { serviceDays: 0, daysInMonth, factor: 0 };
  }

  const startY = startDate.getUTCFullYear();
  const startM = startDate.getUTCMonth() + 1;
  const startDay = startDate.getUTCDate();
  const endY = endDate.getUTCFullYear();
  const endM = endDate.getUTCMonth() + 1;
  const endDay = endDate.getUTCDate();

  const fromDay = startY === periodYear && startM === periodMonth ? startDay : 1;
  const toDay = endY === periodYear && endM === periodMonth ? endDay : daysInMonth;
  const serviceDays = Math.max(0, toDay - fromDay + 1);
  return {
    serviceDays,
    daysInMonth,
    factor: Math.min(1, serviceDays / daysInMonth),
  };
}

/** Días de vigencia ∩ mes calendario UTC / días del mes. */
export function serviceDaysFactorInMonth(
  startDate: Date,
  endDate: Date,
  periodYear: number,
  periodMonth: number
): number {
  return serviceDaysCoverageInMonth(startDate, endDate, periodYear, periodMonth).factor;
}

/** Prorratea la tarifa mensual; los servicios especiales del mes no se recortan. */
export function prorateFixedMonthlyRevenue(
  baseBilling: number,
  specialServicesTotal: number,
  startDate: Date,
  endDate: Date,
  periodYear: number,
  periodMonth: number
): { billing: number; baseBilling: number; factor: number } {
  const factor = serviceDaysFactorInMonth(startDate, endDate, periodYear, periodMonth);
  const proratedBase = baseBilling * factor;
  return {
    billing: proratedBase + specialServicesTotal,
    baseBilling: proratedBase,
    factor,
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
    startDate?: Date;
    endDate?: Date;
  },
  billingHistory: { periodMonth: Date; monthlyBilling: { toString(): string } }[],
  demandBilling: DemandBillingRow[],
  periodYear: number,
  periodMonth: number,
  options?: {
    prorateByServiceDays?: boolean;
    specialServices?: SpecialServiceAmountRow[];
  }
): {
  billing: number | null;
  baseBilling: number | null;
  specialServicesTotal: number;
  amountDefined: boolean;
  serviceDaysFactor: number;
  serviceDays: number | null;
  daysInMonth: number | null;
} {
  const asOf = periodAsOfDate(periodYear, periodMonth);
  const specialServicesTotal = sumSpecialServicesForMonth(
    options?.specialServices ?? [],
    asOf
  );

  if (contract.hiringType === "ON_DEMAND") {
    const amount = getDemandBillingForPeriod(demandBilling, periodYear, periodMonth);
    if (amount === null && specialServicesTotal <= 0) {
      return {
        billing: null,
        baseBilling: null,
        specialServicesTotal: 0,
        amountDefined: false,
        serviceDaysFactor: 1,
        serviceDays: null,
        daysInMonth: null,
      };
    }
    const baseBilling = amount ?? 0;
    return {
      billing: baseBilling + specialServicesTotal,
      baseBilling: amount,
      specialServicesTotal,
      amountDefined: true,
      serviceDaysFactor: 1,
      serviceDays: null,
      daysInMonth: null,
    };
  }
  const catalogBase = parseFloat(contract.monthlyBilling.toString());
  let baseBilling = getEffectiveMonthlyBilling(
    catalogBase,
    billingHistory as { periodMonth: Date; monthlyBilling: number | string }[],
    asOf
  );
  let serviceDaysFactor = 1;
  let serviceDays: number | null = null;
  let daysInMonth: number | null = null;
  if (
    options?.prorateByServiceDays &&
    contract.startDate &&
    contract.endDate
  ) {
    const coverage = serviceDaysCoverageInMonth(
      contract.startDate,
      contract.endDate,
      periodYear,
      periodMonth
    );
    serviceDaysFactor = coverage.factor;
    serviceDays = coverage.serviceDays;
    daysInMonth = coverage.daysInMonth;
    baseBilling *= serviceDaysFactor;
  }
  return {
    billing: baseBilling + specialServicesTotal,
    baseBilling,
    specialServicesTotal,
    amountDefined: true,
    serviceDaysFactor,
    serviceDays,
    daysInMonth,
  };
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
