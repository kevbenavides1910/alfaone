import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { parseCalendarDateInput } from "@/lib/utils/format";
import { serializeSinglePayment, type PagoDto } from "./pagos";

export type PagoProveedorDto = {
  id: string;
  description: string;
  amount: number;
  company: string | null;
  type: string;
  referenceNumber: string | null;
  periodMonth: string;
  paymentDate: string | null;
  notes: string | null;
  createdAt: string;
  /** unscheduled = sin Payment; scheduled_unpaid = ya en calendario pero no marcado pagado */
  status: "unscheduled" | "scheduled_unpaid";
  paymentId: string | null;
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

/**
 * Cola de pago a proveedores:
 * - Gastos aprobados sin Payment EXPENSE (por programar).
 * - Gastos aprobados con Payment EXPENSE impago (ya en calendario; se puede reprogramar fecha).
 * No incluye los ya marcados pagados ni los liquidados por un pago consolidado.
 */
export async function listPagoProveedores(
  companyFilter?: string,
  ocFilter?: string,
): Promise<PagoProveedorDto[]> {
  const oc = ocFilter?.trim() || "";
  const rows = await prisma.expense.findMany({
    where: {
      approvalStatus: "APPROVED",
      deletedAt: null,
      settledByPaymentId: null,
      ...(companyFilter ? { company: companyFilter } : {}),
      ...(oc
        ? {
            OR: [
              { referenceNumber: { contains: oc, mode: "insensitive" } },
              { nafOcNoOrden: { contains: oc, mode: "insensitive" } },
            ],
          }
        : {}),
      AND: [
        {
          OR: [
            { payments: { none: { source: "EXPENSE" } } },
            {
              payments: {
                some: { source: "EXPENSE", paid: false },
              },
            },
          ],
        },
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
      periodMonth: true,
      paymentDate: true,
      notes: true,
      createdAt: true,
      payments: {
        where: { source: "EXPENSE" },
        select: { id: true, paid: true, paymentDate: true },
        take: 1,
      },
    },
    take: 500,
  });

  return rows
    .map((e) => {
      const pay = e.payments[0] ?? null;
      if (pay?.paid) return null;
      const status: PagoProveedorDto["status"] = pay ? "scheduled_unpaid" : "unscheduled";
      return {
        id: e.id,
        description: e.description,
        amount: parseFloat(e.amount.toString()),
        company: e.company,
        type: e.type,
        referenceNumber: e.referenceNumber,
        periodMonth: toIsoMonth(e.periodMonth),
        paymentDate: pay
          ? toIsoDay(pay.paymentDate)
          : e.paymentDate
            ? toIsoDay(e.paymentDate)
            : null,
        notes: e.notes,
        createdAt: e.createdAt.toISOString(),
        status,
        paymentId: pay?.id ?? null,
      } satisfies PagoProveedorDto;
    })
    .filter((r): r is PagoProveedorDto => r != null);
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
    return ref.length > 0 && wanted.has(ref);
  });

  const byId = new Map<string, PagoProveedorDto>();
  for (const row of matched) byId.set(row.id, row);
  return [...byId.values()];
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
 * - Sin Payment → crea Payment EXPENSE (entra al calendario).
 * - Con Payment impago → actualiza fecha.
 * - Con Payment pagado → rechazo.
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
          description: expense.description,
          company: expense.company,
          refType: expense.type,
          referenceNumber: expense.referenceNumber,
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
        description: expense.description,
        amount: expense.amount,
        paymentDate,
        company: expense.company,
        refType: expense.type,
        referenceNumber: expense.referenceNumber,
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
        description: input.description.trim(),
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
