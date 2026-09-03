import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { parseCalendarDateInput } from "@/lib/utils/format";
import { serializeSinglePayment, type PagoDto } from "./pagos";

export type PagoProveedorStatus = "unscheduled" | "scheduled_unpaid" | "paid";

export type PagoProveedorDto = {
  id: string;
  /** Todos los gastos de la misma OC (prorrateo presupuestario = varias filas). */
  expenseIds: string[];
  description: string;
  amount: number;
  company: string | null;
  type: string;
  referenceNumber: string | null;
  periodMonth: string;
  paymentDate: string | null;
  notes: string | null;
  createdAt: string;
  /** unscheduled | scheduled_unpaid | paid */
  status: PagoProveedorStatus;
  paymentId: string | null;
  /** Cuántas filas presupuestarias se agruparon (mes 1/N, diferido, etc.). */
  budgetSlices: number;
};

function toIsoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIsoMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizeOcKey(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^0+/, "").toLowerCase();
}

/** Quita el sufijo «(mes X/Y)» del prorrateo presupuestario. */
export function stripBudgetMonthSuffix(description: string): string {
  return description.replace(/\s*\(mes\s+\d+\s*\/\s*\d+\)\s*$/i, "").trim();
}

function ocGroupKey(e: {
  id: string;
  nafOcNoOrden?: string | null;
  referenceNumber?: string | null;
}): string {
  const fromNaf = normalizeOcKey(e.nafOcNoOrden);
  if (fromNaf) return `oc:${fromNaf}`;
  const fromRef = normalizeOcKey(e.referenceNumber);
  if (fromRef) return `oc:${fromRef}`;
  return `id:${e.id}`;
}

type QueueExpenseRow = {
  id: string;
  description: string;
  amount: { toString(): string };
  company: string | null;
  type: string;
  referenceNumber: string | null;
  nafOcNoOrden: string | null;
  periodMonth: Date;
  paymentDate: Date | null;
  notes: string | null;
  createdAt: Date;
  payments: { id: string; paid: boolean; paymentDate: Date }[];
  settledByPayment: { id: string; paid: boolean; paymentDate: Date } | null;
};

type CalendarPaidHit = { paymentId: string; paymentDate: Date };

type CalendarPaidIndex = {
  byExpenseId: Map<string, CalendarPaidHit>;
  byOcKey: Map<string, CalendarPaidHit>;
};

/** Tokens de OC en referenceNumber del pago (ej. «858», «858, 862»). */
function parsePaymentOcTokens(referenceNumber: string | null | undefined): string[] {
  if (!referenceNumber?.trim()) return [];
  return referenceNumber
    .split(/[,;/|]+/)
    .map((part) => part.replace(/^oc\s*/i, "").trim())
    .map(normalizeOcKey)
    .filter((t) => t.length > 0);
}

/**
 * Índice de pagos ya marcados en verde en el calendario (`Payment.paid = true`).
 * Cubre vínculo por expenseId, settledByPaymentId y N° OC en referenceNumber.
 */
async function loadCalendarPaidIndex(companyFilter?: string): Promise<CalendarPaidIndex> {
  const payments = await prisma.payment.findMany({
    where: {
      paid: true,
      ...(companyFilter ? { company: companyFilter } : {}),
    },
    select: {
      id: true,
      paymentDate: true,
      referenceNumber: true,
      expenseId: true,
      settledExpenses: { select: { id: true } },
    },
    take: 8000,
  });

  const byExpenseId = new Map<string, CalendarPaidHit>();
  const byOcKey = new Map<string, CalendarPaidHit>();

  for (const p of payments) {
    const hit: CalendarPaidHit = { paymentId: p.id, paymentDate: p.paymentDate };
    if (p.expenseId) byExpenseId.set(p.expenseId, hit);
    for (const e of p.settledExpenses) byExpenseId.set(e.id, hit);
    for (const token of parsePaymentOcTokens(p.referenceNumber)) {
      if (!byOcKey.has(token)) byOcKey.set(token, hit);
    }
  }

  return { byExpenseId, byOcKey };
}

function expenseOcKeyForPaid(e: {
  nafOcNoOrden?: string | null;
  referenceNumber?: string | null;
}): string | null {
  const fromNaf = normalizeOcKey(e.nafOcNoOrden);
  if (fromNaf) return fromNaf;
  const fromRef = normalizeOcKey(e.referenceNumber);
  return fromRef || null;
}

function resolveRowStatus(
  e: QueueExpenseRow,
  paidIndex: CalendarPaidIndex,
): {
  status: PagoProveedorStatus;
  paymentId: string | null;
  paymentDate: string | null;
} {
  // Única fuente de «Pagado»: marcado en verde en el calendario.
  const ocKey = expenseOcKeyForPaid(e);
  const calendarPaid =
    paidIndex.byExpenseId.get(e.id) ??
    (ocKey ? paidIndex.byOcKey.get(ocKey) : undefined);

  if (calendarPaid) {
    return {
      status: "paid",
      paymentId: calendarPaid.paymentId,
      paymentDate: toIsoDay(calendarPaid.paymentDate),
    };
  }

  const expensePay = e.payments[0] ?? null;
  const settledPay = e.settledByPayment;
  const scheduled = expensePay ?? settledPay;
  if (scheduled) {
    return {
      status: "scheduled_unpaid",
      paymentId: scheduled.id,
      paymentDate: toIsoDay(scheduled.paymentDate),
    };
  }

  return {
    status: "unscheduled",
    paymentId: null,
    paymentDate: e.paymentDate ? toIsoDay(e.paymentDate) : null,
  };
}

function mapQueueRow(
  e: QueueExpenseRow,
  paidIndex: CalendarPaidIndex,
): Omit<PagoProveedorDto, "expenseIds" | "budgetSlices"> {
  const resolved = resolveRowStatus(e, paidIndex);
  return {
    id: e.id,
    description: e.description,
    amount: parseFloat(e.amount.toString()),
    company: e.company,
    type: e.type,
    referenceNumber: e.nafOcNoOrden?.trim() || e.referenceNumber,
    periodMonth: toIsoMonth(e.periodMonth),
    paymentDate: resolved.paymentDate,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    status: resolved.status,
    paymentId: resolved.paymentId,
  };
}

function groupStatus(statuses: PagoProveedorStatus[]): PagoProveedorStatus {
  if (statuses.length > 0 && statuses.every((s) => s === "paid")) return "paid";
  if (statuses.some((s) => s === "unscheduled")) return "unscheduled";
  if (statuses.some((s) => s === "scheduled_unpaid")) return "scheduled_unpaid";
  return "paid";
}

/**
 * Agrupa filas de la cola por OC: el diferido/prorrateo es solo presupuesto;
 * en pagos la OC aparece una vez con el monto total.
 */
function collapseByOc(
  rows: QueueExpenseRow[],
  paidIndex: CalendarPaidIndex,
): PagoProveedorDto[] {
  const groups = new Map<string, QueueExpenseRow[]>();
  for (const row of rows) {
    const key = ocGroupKey(row);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const out: PagoProveedorDto[] = [];
  for (const group of groups.values()) {
    const mapped = group.map((row) => mapQueueRow(row, paidIndex));
    if (mapped.length === 0) continue;

    mapped.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth) || a.createdAt.localeCompare(b.createdAt));
    const status = groupStatus(mapped.map((r) => r.status));
    const active =
      status === "paid" ? mapped : mapped.filter((r) => r.status !== "paid");
    if (active.length === 0) continue;

    const primary = active[0];
    const amount =
      Math.round(active.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    const withDate =
      active.find((r) => r.status === status && r.paymentDate) ??
      active.find((r) => r.paymentDate) ??
      primary;

    out.push({
      id: primary.id,
      expenseIds: active.map((r) => r.id),
      description: stripBudgetMonthSuffix(primary.description),
      amount,
      company: primary.company,
      type: primary.type,
      referenceNumber: primary.referenceNumber,
      periodMonth: primary.periodMonth,
      paymentDate: withDate.paymentDate,
      notes: primary.notes,
      createdAt: primary.createdAt,
      status,
      paymentId: withDate.paymentId,
      budgetSlices: mapped.length,
    });
  }

  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

/**
 * Cola de pago a proveedores:
 * - Sin programar / en calendario (impago) / pagado (verde en calendario).
 * - Misma OC (prorrateo / diferido presupuestario) → una sola fila con monto sumado.
 * «Pagado» = `Payment.paid` en el calendario (círculo verde), no solo programado.
 */
export async function listPagoProveedores(
  companyFilter?: string,
  ocFilter?: string,
  options?: { includePaid?: boolean },
): Promise<PagoProveedorDto[]> {
  const oc = ocFilter?.trim() || "";
  const includePaid = options?.includePaid === true;

  const [paidIndex, rows] = await Promise.all([
    loadCalendarPaidIndex(companyFilter),
    prisma.expense.findMany({
      where: {
        approvalStatus: "APPROVED",
        deletedAt: null,
        ...(companyFilter ? { company: companyFilter } : {}),
        ...(oc
          ? {
              OR: [
                { referenceNumber: { contains: oc, mode: "insensitive" } },
                { nafOcNoOrden: { contains: oc, mode: "insensitive" } },
              ],
            }
          : {}),
        OR: [
          {
            settledByPaymentId: null,
            payments: { none: { source: "EXPENSE" } },
          },
          {
            payments: { some: { source: "EXPENSE", paid: false } },
          },
          {
            settledByPaymentId: { not: null },
          },
          ...(includePaid
            ? [{ payments: { some: { source: "EXPENSE" as const, paid: true } } }]
            : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        description: true,
        amount: true,
        company: true,
        type: true,
        referenceNumber: true,
        nafOcNoOrden: true,
        periodMonth: true,
        paymentDate: true,
        notes: true,
        createdAt: true,
        payments: {
          where: { source: "EXPENSE" },
          select: { id: true, paid: true, paymentDate: true },
          orderBy: [{ paid: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
        settledByPayment: {
          select: { id: true, paid: true, paymentDate: true },
        },
      },
      take: 3000,
    }),
  ]);

  let list = collapseByOc(rows as QueueExpenseRow[], paidIndex);
  if (!includePaid) {
    list = list.filter((r) => r.status !== "paid");
  }
  return list;
}

/**
 * Resuelve gastos de la cola por N° OC (sin filtrar compañía).
 * Prefiere coincidencia exacta de `referenceNumber` / `nafOcNoOrden`.
 */
export async function findProveedoresByOcNumbers(
  ocNumbers: string[],
): Promise<PagoProveedorDto[]> {
  const cleaned = [...new Set(ocNumbers.map((o) => o.trim()).filter(Boolean))];
  if (cleaned.length === 0) return [];

  const queue = await listPagoProveedores();
  const wanted = new Set(cleaned.map(normalizeOcKey));
  const matched = queue.filter((e) => {
    const ref = normalizeOcKey(e.referenceNumber);
    return ref.length > 0 && wanted.has(ref) && e.status !== "paid";
  });

  const byId = new Map<string, PagoProveedorDto>();
  for (const row of matched) byId.set(row.id, row);
  return [...byId.values()];
}

/** Ids de todos los gastos pendientes que comparten la misma OC (o solo el id si no hay OC). */
export async function resolveProveedorExpenseGroupIds(expenseId: string): Promise<string[]> {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, deletedAt: null },
    select: { id: true, referenceNumber: true, nafOcNoOrden: true },
  });
  if (!expense) return [expenseId];

  const oc = (expense.nafOcNoOrden || expense.referenceNumber || "").trim();
  if (!oc) return [expense.id];

  const queue = await listPagoProveedores(undefined, oc);
  const key = normalizeOcKey(oc);
  const group = queue.find(
    (r) => normalizeOcKey(r.referenceNumber) === key && r.status !== "paid",
  );
  if (group?.expenseIds.length) return group.expenseIds;
  return [expense.id];
}

export class ScheduleExpenseError extends Error {
  code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT";
  constructor(code: ScheduleExpenseError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Asigna o actualiza fecha de pago de un gasto aprobado.
 * Si la OC está prorrateada en varios meses (presupuesto), liquida todas las
 * rebanadas en un solo movimiento con el monto total.
 */
export async function scheduleExpensePayment(input: {
  expenseId: string;
  paymentDate: string;
  userId: string;
}): Promise<PagoDto> {
  const paymentDate = parseCalendarDateInput(input.paymentDate);
  if (!paymentDate) {
    throw new ScheduleExpenseError("BAD_REQUEST", "Fecha de pago inválida (YYYY-MM-DD)");
  }

  const groupIds = await resolveProveedorExpenseGroupIds(input.expenseId);
  if (groupIds.length > 1) {
    const expenses = await prisma.expense.findMany({
      where: { id: { in: groupIds }, deletedAt: null },
      select: {
        id: true,
        description: true,
        amount: true,
        company: true,
        referenceNumber: true,
        nafOcNoOrden: true,
        notes: true,
      },
    });
    const total =
      Math.round(
        expenses.reduce((s, e) => s + parseFloat(e.amount.toString()), 0) * 100,
      ) / 100;
    const primary =
      expenses.find((e) => e.id === input.expenseId) ?? expenses[0];
    return createPaymentFromProveedorExpenses({
      expenseIds: groupIds,
      paymentDate: input.paymentDate,
      userId: input.userId,
      description: stripBudgetMonthSuffix(primary.description),
      amount: total,
      company: primary.company,
      notes: primary.notes,
      referenceNumber:
        primary.nafOcNoOrden?.trim() || primary.referenceNumber?.trim() || null,
    });
  }

  const expense = await prisma.expense.findFirst({
    where: { id: input.expenseId, deletedAt: null },
  });
  if (!expense) {
    throw new ScheduleExpenseError("NOT_FOUND", "Gasto no encontrado");
  }
  if (expense.approvalStatus !== "APPROVED") {
    throw new ScheduleExpenseError("BAD_REQUEST", "Solo se pueden programar gastos aprobados");
  }
  if (expense.settledByPaymentId) {
    throw new ScheduleExpenseError(
      "CONFLICT",
      "Este gasto ya está liquidado en otro pago del calendario",
    );
  }

  const existing = await prisma.payment.findFirst({
    where: { source: "EXPENSE", expenseId: expense.id },
  });
  if (existing?.paid) {
    throw new ScheduleExpenseError(
      "CONFLICT",
      "Este gasto ya está marcado como pagado en el calendario",
    );
  }

  const prevDate = existing ? toIsoDay(existing.paymentDate) : null;
  const newDate = toIsoDay(paymentDate);

  const saved = await prisma.$transaction(async (tx) => {
    if (existing) {
      const updated = await tx.payment.update({
        where: { id: existing.id },
        data: {
          paymentDate,
          description: stripBudgetMonthSuffix(expense.description),
          company: expense.company,
          refType: expense.type,
          referenceNumber: expense.nafOcNoOrden?.trim() || expense.referenceNumber,
          updatedById: input.userId,
        },
      });
      await tx.expense.update({
        where: { id: expense.id },
        data: { paymentDate, settledByPaymentId: updated.id },
      });
      return updated;
    }

    const created = await tx.payment.create({
      data: {
        source: "EXPENSE",
        expenseId: expense.id,
        description: stripBudgetMonthSuffix(expense.description),
        amount: expense.amount,
        paymentDate,
        company: expense.company,
        refType: expense.type,
        referenceNumber: expense.nafOcNoOrden?.trim() || expense.referenceNumber,
        notes: expense.notes,
        createdById: input.userId,
        updatedById: input.userId,
      },
    });
    await tx.expense.update({
      where: { id: expense.id },
      data: { paymentDate, settledByPaymentId: created.id },
    });
    return created;
  });

  if (prevDate !== newDate) {
    await prisma.paymentChangeLog.create({
      data: {
        paymentId: saved.id,
        field: "paymentDate",
        previousValue: prevDate,
        newValue: newDate,
        changedById: input.userId,
      },
    });
  }

  return serializeSinglePayment(saved);
}

/**
 * Un solo movimiento de calendario que liquida uno o varios gastos de «Pago proveedores»
 * (varias OC). Saca todos de la cola vía `settledByPaymentId`.
 */
export async function createPaymentFromProveedorExpenses(input: {
  expenseIds: string[];
  paymentDate: string;
  userId: string;
  description: string;
  amount: number;
  company?: string | null;
  notes?: string | null;
  category?: string | null;
  subcategory?: string | null;
  referenceNumber?: string | null;
}): Promise<PagoDto> {
  const ids = [...new Set(input.expenseIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw new ScheduleExpenseError("BAD_REQUEST", "Se requiere al menos un gasto de proveedores");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ScheduleExpenseError("BAD_REQUEST", "El monto debe ser mayor a 0");
  }
  const paymentDate = parseCalendarDateInput(input.paymentDate);
  if (!paymentDate) {
    throw new ScheduleExpenseError("BAD_REQUEST", "Fecha de pago inválida (YYYY-MM-DD)");
  }

  const expenses = await prisma.expense.findMany({
    where: { id: { in: ids }, deletedAt: null },
    include: {
      payments: {
        where: { source: "EXPENSE" },
        select: { id: true, paid: true },
      },
    },
  });
  if (expenses.length !== ids.length) {
    throw new ScheduleExpenseError("NOT_FOUND", "Uno o más gastos no existen");
  }
  for (const expense of expenses) {
    if (expense.approvalStatus !== "APPROVED") {
      throw new ScheduleExpenseError(
        "BAD_REQUEST",
        `El gasto «${expense.description}» no está aprobado`,
      );
    }
    if (expense.settledByPaymentId) {
      throw new ScheduleExpenseError(
        "CONFLICT",
        `El gasto OC ${expense.referenceNumber || expense.id} ya está liquidado en otro pago`,
      );
    }
    if (expense.payments.some((p) => p.paid)) {
      throw new ScheduleExpenseError(
        "CONFLICT",
        `El gasto OC ${expense.referenceNumber || expense.id} ya está marcado pagado`,
      );
    }
  }

  const ocRefs = expenses
    .map((e) => (e.nafOcNoOrden || e.referenceNumber || "").trim())
    .filter(Boolean);
  const referenceNumber =
    input.referenceNumber?.trim() ||
    [...new Set(ocRefs)].join(", ") ||
    null;

  const amountDec = new Prisma.Decimal(input.amount.toFixed(2));
  const single = expenses.length === 1 ? expenses[0] : null;

  const saved = await prisma.$transaction(async (tx) => {
    const priorIds = expenses.flatMap((e) => e.payments.map((p) => p.id));
    if (priorIds.length > 0) {
      await tx.paymentChangeLog.deleteMany({ where: { paymentId: { in: priorIds } } });
      await tx.payment.deleteMany({ where: { id: { in: priorIds } } });
    }

    const payment = await tx.payment.create({
      data: {
        source: single ? "EXPENSE" : "MANUAL",
        expenseId: single?.id ?? null,
        description: stripBudgetMonthSuffix(input.description.trim()),
        amount: amountDec,
        paymentDate,
        company: input.company?.trim() || single?.company || null,
        refType: single?.type ?? null,
        referenceNumber,
        notes: input.notes?.trim() || null,
        category: input.category ?? null,
        subcategory: input.subcategory ?? null,
        createdById: input.userId,
        updatedById: input.userId,
      },
    });

    await tx.expense.updateMany({
      where: { id: { in: ids } },
      data: {
        paymentDate,
        settledByPaymentId: payment.id,
      },
    });

    return payment;
  });

  return serializeSinglePayment(saved);
}
