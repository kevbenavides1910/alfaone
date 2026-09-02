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

/** Gastos aprobados sin Payment EXPENSE (pendientes de programar en calendario). */
export async function listPagoProveedores(companyFilter?: string): Promise<PagoProveedorDto[]> {
  const rows = await prisma.expense.findMany({
    where: {
      approvalStatus: "APPROVED",
      deletedAt: null,
      payments: { none: { source: "EXPENSE" } },
      ...(companyFilter ? { company: companyFilter } : {}),
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
    },
    take: 500,
  });

  return rows.map((e) => ({
    id: e.id,
    description: e.description,
    amount: parseFloat(e.amount.toString()),
    company: e.company,
    type: e.type,
    referenceNumber: e.referenceNumber,
    periodMonth: toIsoMonth(e.periodMonth),
    paymentDate: e.paymentDate ? toIsoDay(e.paymentDate) : null,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  }));
}

export class ScheduleExpenseError extends Error {
  code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT";
  constructor(code: ScheduleExpenseError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Asigna fecha de pago a un gasto aprobado y crea el Payment EXPENSE
 * para que aparezca en el calendario diario.
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

  const existing = await prisma.payment.findFirst({
    where: { source: "EXPENSE", expenseId: expense.id },
  });
  if (existing) {
    throw new ScheduleExpenseError(
      "CONFLICT",
      "Este gasto ya está en el calendario de pagos",
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: expense.id },
      data: { paymentDate },
    });
    return tx.payment.create({
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
  });

  await prisma.paymentChangeLog.create({
    data: {
      paymentId: created.id,
      field: "paymentDate",
      previousValue: null,
      newValue: toIsoDay(paymentDate),
      changedById: input.userId,
    },
  });

  return serializeSinglePayment(created);
}
