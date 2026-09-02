import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  listApexCalendarioPagos,
  listApexCalendarioPagosBase,
  type ApexCalendarioPagoBaseRow,
  type ApexCalendarioPagoRow,
} from "./apex-calendario";

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

/**
 * Sincroniza el mes: garantiza que exista un Payment para cada gasto aprobado
 * del mes y para cada pago fijo APEX del mes. Luego lista los payments del mes.
 */
export async function syncAndListPayments(
  month: string, // "YYYY-MM"
  companyFilter?: string,
): Promise<PagoDto[]> {
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  await syncExpensesForMonth(from, to);
  try {
    await syncApexForMonth(from, to);
  } catch (error) {
    console.warn("[pagos] sync APEX falló; se listan pagos locales del mes:", error);
  }

  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: from, lt: to },
      ...(companyFilter ? { company: companyFilter } : {}),
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

/** Materializa los gastos APROBADOS del mes como Payments (EXPENSE). */
async function syncExpensesForMonth(from: Date, to: Date): Promise<number> {
  const approved = await prisma.expense.findMany({
    where: {
      approvalStatus: "APPROVED",
      deletedAt: null,
      paymentDate: { gte: from, lt: to },
    },
    select: {
      id: true,
      description: true,
      amount: true,
      paymentDate: true,
      periodMonth: true,
      createdAt: true,
      company: true,
      type: true,
      referenceNumber: true,
    },
  });

  let created = 0;
  for (const exp of approved) {
    const paymentDate = resolveExpensePaymentDate(exp);
    const exists = await prisma.payment.findFirst({
      where: { source: "EXPENSE", expenseId: exp.id },
      select: { id: true },
    });
    const payload = {
      description: exp.description,
      amount: exp.amount,
      paymentDate,
      company: exp.company,
      refType: exp.type,
      referenceNumber: exp.referenceNumber,
    };
    if (exists) {
      // No pisar amount/paymentDate: se editan en el calendario y quedan en bitácora.
      await prisma.payment.update({
        where: { id: exists.id },
        data: {
          description: exp.description,
          company: exp.company,
          refType: exp.type,
          referenceNumber: exp.referenceNumber,
        },
      });
      continue;
    }
    await prisma.payment.create({
      data: {
        source: "EXPENSE",
        expenseId: exp.id,
        ...payload,
      },
    });
    created += 1;
  }
  return created;
}

function resolveExpensePaymentDate(exp: {
  paymentDate: Date | null;
  periodMonth: Date;
  createdAt: Date;
}): Date {
  if (exp.paymentDate) return exp.paymentDate;
  const c = exp.createdAt;
  return new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate()));
}

/** Materializa los gastos fijos APEX del mes como Payments (APEX). */
async function syncApexForMonth(
  from: Date,
  to: Date,
  prefetch?: ApexPrefetch,
): Promise<number> {
  const base = prefetch?.base ?? (await listApexCalendarioPagosBase());
  const pagos = prefetch?.pagos ?? (await listApexCalendarioPagos());

  const inMonth = pagos.filter((p) => {
    if (!p.fechaPago) return false;
    const d = new Date(p.fechaPago + "T00:00:00Z");
    return d >= from && d < to;
  });

  const baseMap = new Map<number, (typeof base)[number]>();
  for (const b of base) baseMap.set(b.pagoBaseId, b);

  // Deduplicar ocurrencias de Oracle: un gasto fijo puede venir repetido (mismo
  // pagoBaseId + misma fecha) con distinto pagoId. Agrupamos y creamos UN solo
  // Payment por (apexPagoBaseId, fechaPago) para evitar copias duplicadas.
  const seen = new Set<string>();
  let created = 0;
  for (const p of inMonth) {
    const key = `${p.pagoBaseId ?? 0}|${p.fechaPago}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const paymentDate = new Date(p.fechaPago + "T00:00:00Z");
    const exists = await prisma.payment.findFirst({
      where: {
        source: "APEX",
        OR: [
          { apexPagoId: p.pagoId },
          {
            apexPagoBaseId: p.pagoBaseId ?? null,
            paymentDate,
          },
        ],
      },
      select: { id: true },
    });
    if (exists) continue;
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
      },
    });
    created += 1;
  }
  return created;
}

/** Devuelve el calendario del mes como días { fecha, pagos, totales }. */
export async function getCalendarMonth(
  month: string,
  companyFilter?: string,
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
  companyFilter?: string,
  limit = OC_SEARCH_MAX,
): Promise<PagoDto[]> {
  const q = oc.trim();
  if (!q) return [];

  const take = Math.min(Math.max(limit, 1), OC_SEARCH_MAX);
  const rows = await prisma.payment.findMany({
    where: {
      referenceNumber: { contains: q, mode: "insensitive" },
      ...(companyFilter ? { company: companyFilter } : {}),
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