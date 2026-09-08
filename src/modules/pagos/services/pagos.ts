import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  listApexCalendarioPagos,
  listApexCalendarioPagosBase,
  type ApexCalendarioPagoBaseRow,
  type ApexCalendarioPagoRow,
} from "./apex-calendario";
import {
  expandPaymentCompanyFilter,
  paymentCompanyWhere,
  type PaymentCompanyFilter,
} from "./payment-company-filter";

/**
 * Servicio del módulo de Pagos (calendario).
 *
 * Unifica tres fuentes en un único calendario mensual:
 *   1. EXPENSE — gastos APROBADOS del módulo de Gastos
 *   2. APEX    — gastos fijos del calendario APEX (Oracle, solo lectura)
 *   3. MANUAL  — pagos agregados a mano
 *
 * Los gastos fijos APEX y los gastos aprobados se materializan como
 * Payment (Postgres) al sincronizar el mes, para poder marcarlos pagado/pendiente.
 * El estado `paid` se persiste localmente; nunca se escribe de vuelta a Oracle.
 *
 * Unicidad:
 *   - EXPENSE: un Payment por expenseId (los gastos aprobados son "a pagar").
 *   - APEX:    un Payment por (apexPagoBaseId, fechaPago).
 *   - MANUAL:  siempre crea uno nuevo.
 */

type ApexPrefetch = {
  base: ApexCalendarioPagoBaseRow[];
  pagos: ApexCalendarioPagoRow[];
};

export type PagoFuente = "EXPENSE" | "APEX" | "MANUAL";

export type PagoDto = {
  id: string;
  source: PagoFuente;
  expenseId: string | null;
  apexPagoId: number | null;
  apexPagoBaseId: number | null;
  description: string;
  amount: number;
  paymentDate: string; // ISO
  company: string | null;
  refType: string | null;
  referenceNumber: string | null;
  category: string | null;
  subcategory: string | null;
  paid: boolean;
  paidAt: string | null;
  notes: string | null;
  /** APEX confirmado para el calendario diario (o ya pagado en verde). */
  confirmedForDaily: boolean;
};

export type CalendarDay = {
  date: string; // ISO yyyy-mm-dd
  payments: PagoDto[];
  total: number;
  totalPaid: number;
};

export function serializeSinglePayment(p: {
  id: string;
  source: string;
  expenseId: string | null;
  apexPagoId: number | null;
  apexPagoBaseId: number | null;
  description: string;
  amount: Prisma.Decimal;
  paymentDate: Date;
  company: string | null;
  refType: string | null;
  referenceNumber: string | null;
  category: string | null;
  subcategory: string | null;
  paid: boolean;
  paidAt: Date | null;
  notes: string | null;
  confirmedForDaily?: boolean;
}): PagoDto {
  return {
    id: p.id,
    source: p.source as PagoFuente,
    expenseId: p.expenseId,
    apexPagoId: p.apexPagoId,
    apexPagoBaseId: p.apexPagoBaseId,
    description: p.description,
    amount: parseFloat(p.amount.toString()),
    paymentDate: toIsoDay(p.paymentDate),
    company: p.company,
    refType: p.refType,
    referenceNumber: p.referenceNumber,
    category: p.category,
    subcategory: p.subcategory,
    paid: p.paid,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    notes: p.notes,
    confirmedForDaily: Boolean(p.confirmedForDaily) || p.paid,
  };
}

function toIsoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function endOfMonth(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)); // exclusive
}

/** Si Oracle/dblink se cuelga, el GET no debe quedar en “cargando…”. */
const APEX_GET_SYNC_TIMEOUT_MS = 3500;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Lista el calendario del mes desde Postgres.
 * Solo materializa APEX si el mes aún no tiene pagos fijos (primer open),
 * con timeout para no bloquear la UI. Actualización completa: POST /api/pagos/sync.
 */
export async function syncAndListPayments(
  month: string, // "YYYY-MM"
  companyFilter?: PaymentCompanyFilter,
): Promise<PagoDto[]> {
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const apexInMonth = await prisma.payment.count({
    where: { source: "APEX", paymentDate: { gte: from, lt: to } },
  });

  if (apexInMonth === 0) {
    try {
      await withTimeout(
        syncApexForMonth(from, to),
        APEX_GET_SYNC_TIMEOUT_MS,
        "[pagos] sync APEX",
      );
    } catch (error) {
      console.warn("[pagos] sync APEX falló/timeout; se listan pagos locales del mes:", error);
    }
  }

  const companyCodes = await expandPaymentCompanyFilter(companyFilter);
  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: from, lt: to },
      ...paymentCompanyWhere(companyCodes),
    },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
  });
  return payments.map(serializeSinglePayment);
}

export type SyncPaymentsYearResult = {
  year: number;
  fromMonth: string;
  toMonth: string;
  monthsSynced: string[];
  expensesCreated: number;
  apexCreated: number;
};

/**
 * Trae (materializa) gastos aprobados + pagos fijos APEX para un rango de meses
 * del año. Por defecto: enero → mes anterior al actual (meses ya cerrados).
 */
export async function syncPaymentsForYear(options?: {
  year?: number;
  /** Inclusive, 1–12. Default 1. */
  fromMonth?: number;
  /** Inclusive, 1–12. Default: mes calendario anterior (o 12 si year < actual). */
  toMonth?: number;
}): Promise<SyncPaymentsYearResult> {
  const now = new Date();
  const year = options?.year ?? now.getFullYear();
  const fromMonth = Math.min(12, Math.max(1, options?.fromMonth ?? 1));
  let toMonth = options?.toMonth;
  if (toMonth == null) {
    if (year < now.getFullYear()) toMonth = 12;
    else if (year > now.getFullYear()) toMonth = 0;
    else toMonth = Math.max(0, now.getMonth()); // getMonth() = mes actual 0-based → anterior
  }
  toMonth = Math.min(12, Math.max(0, toMonth));
  if (toMonth < fromMonth) {
    return {
      year,
      fromMonth: `${year}-${String(fromMonth).padStart(2, "0")}`,
      toMonth: `${year}-${String(fromMonth).padStart(2, "0")}`,
      monthsSynced: [],
      expensesCreated: 0,
      apexCreated: 0,
    };
  }

  let apex: ApexPrefetch | undefined;
  try {
    apex = {
      base: await listApexCalendarioPagosBase(),
      pagos: await listApexCalendarioPagos(),
    };
  } catch (error) {
    console.warn("[pagos] no se pudo leer calendario APEX para sync anual:", error);
  }

  const monthsSynced: string[] = [];
  let expensesCreated = 0;
  let apexCreated = 0;

  for (let m = fromMonth; m <= toMonth; m++) {
    const month = `${year}-${String(m).padStart(2, "0")}`;
    const from = startOfMonth(month);
    const to = endOfMonth(month);
    expensesCreated += await syncExpensesForMonth(from, to);
    if (apex) {
      apexCreated += await syncApexForMonth(from, to, apex);
    }
    monthsSynced.push(month);
  }

  return {
    year,
    fromMonth: `${year}-${String(fromMonth).padStart(2, "0")}`,
    toMonth: `${year}-${String(toMonth).padStart(2, "0")}`,
    monthsSynced,
    expensesCreated,
    apexCreated,
  };
}

/**
 * Sincroniza metadatos de Payments EXPENSE ya existentes para el mes.
 * No crea pagos nuevos: los gastos aprobados entran al calendario solo cuando
 * se les asigna fecha en Pagos → Pago proveedores.
 * Los EXPENSE ya marcados pagados (verde) se preservan; los impagos del sync
 * automático viejo se sacaron del calendario (cola proveedores).
 */
async function syncExpensesForMonth(from: Date, to: Date): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: {
      source: "EXPENSE",
      expenseId: { not: null },
      paymentDate: { gte: from, lt: to },
    },
    select: { id: true, expenseId: true },
  });

  if (payments.length === 0) return 0;

  const expenseIds = [...new Set(payments.map((p) => p.expenseId!).filter(Boolean))];
  const expenses = await prisma.expense.findMany({
    where: { id: { in: expenseIds }, deletedAt: null },
    select: {
      id: true,
      description: true,
      company: true,
      type: true,
      referenceNumber: true,
    },
  });
  const byId = new Map(expenses.map((e) => [e.id, e]));

  await Promise.all(
    payments.map(async (p) => {
      if (!p.expenseId) return;
      const exp = byId.get(p.expenseId);
      if (!exp) return;
      await prisma.payment.update({
        where: { id: p.id },
        data: {
          description: exp.description,
          company: exp.company,
          refType: exp.type,
          referenceNumber: exp.referenceNumber,
        },
      });
    }),
  );
  return 0;
}

/** Materializa los gastos fijos APEX del mes como Payments (APEX). */
async function syncApexForMonth(
  from: Date,
  to: Date,
  prefetch?: ApexPrefetch,
): Promise<number> {
  const fromDay = toIsoDay(from);
  const toDay = toIsoDay(to);
  const base = prefetch?.base ?? (await listApexCalendarioPagosBase());
  const pagos =
    prefetch?.pagos ?? (await listApexCalendarioPagos({ from: fromDay, to: toDay }));

  const inMonth = pagos.filter((p) => {
    if (!p.fechaPago) return false;
    const d = new Date(p.fechaPago + "T00:00:00Z");
    return d >= from && d < to;
  });

  const baseMap = new Map<number, (typeof base)[number]>();
  for (const b of base) baseMap.set(b.pagoBaseId, b);

  const existing = await prisma.payment.findMany({
    where: {
      source: "APEX",
      paymentDate: { gte: from, lt: to },
    },
    select: { apexPagoId: true, apexPagoBaseId: true, paymentDate: true },
  });
  const byPagoId = new Set<number>();
  const byBaseDate = new Set<string>();
  for (const e of existing) {
    if (e.apexPagoId != null) byPagoId.add(e.apexPagoId);
    byBaseDate.add(`${e.apexPagoBaseId ?? 0}|${toIsoDay(e.paymentDate)}`);
  }

  // Deduplicar ocurrencias de Oracle: un gasto fijo puede venir repetido (mismo
  // pagoBaseId + misma fecha) con distinto pagoId. Agrupamos y creamos UN solo
  // Payment por (apexPagoBaseId, fechaPago) para evitar copias duplicadas.
  const seen = new Set<string>();
  let created = 0;
  for (const p of inMonth) {
    const key = `${p.pagoBaseId ?? 0}|${p.fechaPago}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (byPagoId.has(p.pagoId) || byBaseDate.has(key)) continue;

    const paymentDate = new Date(p.fechaPago + "T00:00:00Z");
    const b = p.pagoBaseId != null ? baseMap.get(p.pagoBaseId) : undefined;
    const atendido = (p.atendido ?? "N").trim().toUpperCase() === "S";
    await prisma.payment.create({
      data: {
        source: "APEX",
        apexPagoId: p.pagoId,
        apexPagoBaseId: p.pagoBaseId,
        description: b?.descripcion ?? `Pago fijo #${p.pagoBaseId}`,
        amount: b?.monto ?? p.montoPagado,
        paymentDate,
        company: b?.ciaPaga,
        refType: b?.tipo,
        paid: atendido,
        paidAt: atendido ? paymentDate : null,
        // Solo los ya atendidos en Oracle entran al diario; el resto se confirma en «Pagos fijos».
        confirmedForDaily: atendido,
      },
    });
    byPagoId.add(p.pagoId);
    byBaseDate.add(key);
    created += 1;
  }
  return created;
}

/** Devuelve el calendario del mes como días { fecha, pagos, totales }. */
export async function getCalendarMonth(
  month: string,
  companyFilter?: PaymentCompanyFilter,
): Promise<CalendarDay[]> {
  const payments = await syncAndListPayments(month, companyFilter);
  const byDay = new Map<string, PagoDto[]>();
  for (const p of payments) {
    const arr = byDay.get(p.paymentDate) ?? [];
    arr.push(p);
    byDay.set(p.paymentDate, arr);
  }
  const days = new CalendarDraftGenerator(month).days;
  const result: CalendarDay[] = [];
  for (const d of days) {
    const list = byDay.get(d) ?? [];
    result.push({
      date: d,
      payments: list,
      total: list.reduce((s, p) => s + p.amount, 0),
      totalPaid: list.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0),
    });
  }
  return result;
}

const OC_SEARCH_MAX = 100;

/**
 * Busca pagos por número de OC (`referenceNumber`) en todos los meses materializados.
 * No sincroniza Oracle/gastos: solo consulta lo ya guardado en Postgres.
 */
export async function searchPaymentsByOc(
  oc: string,
  companyFilter?: PaymentCompanyFilter,
  limit = OC_SEARCH_MAX,
): Promise<PagoDto[]> {
  const q = oc.trim();
  if (!q) return [];

  const take = Math.min(Math.max(limit, 1), OC_SEARCH_MAX);
  const companyCodes = await expandPaymentCompanyFilter(companyFilter);
  const rows = await prisma.payment.findMany({
    where: {
      referenceNumber: { contains: q, mode: "insensitive" },
      ...paymentCompanyWhere(companyCodes),
    },
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(serializeSinglePayment);
}

class CalendarDraftGenerator {
  days: string[] = [];
  constructor(month: string) {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0));
    const label = (d: Date) =>
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    for (let d = new Date(first); d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
      this.days.push(label(d));
    }
  }
}