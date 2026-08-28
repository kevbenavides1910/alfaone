import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  listApexCalendarioPagos,
  listApexCalendarioPagosBase,
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
 *   - APEX:    un Payment por apexPagoId.
 *   - MANUAL:  siempre crea uno nuevo.
 */

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
  await syncApexForMonth(from, to);

  const payments = await prisma.payment.findMany({
    where: {
      paymentDate: { gte: from, lt: to },
      ...(companyFilter ? { company: companyFilter } : {}),
    },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
  });
  return payments.map(serializeSinglePayment);
}

/** Materializa los gastos APROBADOS del mes como Payments (EXPENSE). */
async function syncExpensesForMonth(from: Date, to: Date) {
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
  }
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
async function syncApexForMonth(from: Date, to: Date) {
  const base = await listApexCalendarioPagosBase();
  const pagos = await listApexCalendarioPagos();

  const inMonth = pagos.filter((p) => {
    const d = new Date(p.fechaPago + "T00:00:00Z");
    return d >= from && d < to;
  });

  const baseMap = new Map<number, (typeof base)[number]>();
  for (const b of base) baseMap.set(b.pagoBaseId, b);

  for (const p of inMonth) {
    const exists = await prisma.payment.findUnique({
      where: { apexPagoId_source: { apexPagoId: p.pagoId, source: "APEX" } },
      select: { id: true },
    });
    if (exists) continue;
    const b = p.pagoBaseId != null ? baseMap.get(p.pagoBaseId) : undefined;
    await prisma.payment.create({
      data: {
        source: "APEX",
        apexPagoId: p.pagoId,
        apexPagoBaseId: p.pagoBaseId,
        description: b?.descripcion ?? `Pago fijo #${p.pagoBaseId}`,
        amount: b?.monto ?? p.montoPagado,
        paymentDate: new Date(p.fechaPago + "T00:00:00Z"),
        company: b?.ciaPaga,
        refType: b?.tipo,
      },
    });
  }
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