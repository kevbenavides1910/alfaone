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

/**
 * Cola de pago a proveedores:
 * - Gastos aprobados sin Payment EXPENSE (por programar).
 * - Gastos aprobados con Payment EXPENSE impago (ya en calendario; se puede reprogramar fecha).
 * No incluye los ya marcados pagados.
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
    await tx.expense.update({
      where: { id: expense.id },
      data: { paymentDate },
    });

    if (existing) {
      return tx.payment.update({
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
    }

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
