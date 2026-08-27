import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { serializeSinglePayment, type PagoDto } from "./pagos";
import { parseCalendarDateInput } from "@/lib/utils/format";

export type PaymentChangeLogDto = {
  id: string;
  field: string;
  fieldLabel: string;
  previousValue: string | null;
  newValue: string | null;
  changedByName: string | null;
  createdAt: string;
};

export type UpdatePaymentInput = {
  paid?: boolean;
  notes?: string;
  description?: string;
  referenceNumber?: string;
  amount?: number;
  paymentDate?: string; // YYYY-MM-DD
};

const FIELD_LABELS: Record<string, string> = {
  amount: "Monto",
  paymentDate: "Fecha de pago",
  paid: "Estado",
  description: "Descripción",
  notes: "Notas",
  referenceNumber: "Referencia",
};

function formatStoredAmount(n: Prisma.Decimal | number): string {
  return Number(n.toString()).toFixed(2);
}

function formatStoredDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayPaid(v: string | null | undefined): string {
  if (v === "true") return "Pagado";
  if (v === "false") return "Pendiente";
  return v ?? "—";
}

export function serializeChangeLog(row: {
  id: string;
  field: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: Date;
  changedBy: { name: string } | null;
}): PaymentChangeLogDto {
  const field = row.field;
  let previousValue = row.previousValue;
  let newValue = row.newValue;
  if (field === "paid") {
    previousValue = displayPaid(previousValue);
    newValue = displayPaid(newValue);
  }
  return {
    id: row.id,
    field,
    fieldLabel: FIELD_LABELS[field] ?? field,
    previousValue,
    newValue,
    changedByName: row.changedBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPaymentChangeLogs(paymentId: string): Promise<PaymentChangeLogDto[]> {
  const rows = await prisma.paymentChangeLog.findMany({
    where: { paymentId },
    orderBy: { createdAt: "desc" },
    include: { changedBy: { select: { name: true } } },
  });
  return rows.map(serializeChangeLog);
}

/**
 * Actualiza un pago (monto, fecha, estado, etc.) y escribe una fila por campo en la bitácora.
 */
export async function updatePaymentWithAudit(
  paymentId: string,
  input: UpdatePaymentInput,
  userId: string,
): Promise<PagoDto> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    const err = new Error("Pago no encontrado");
    (err as Error & { code: string }).code = "NOT_FOUND";
    throw err;
  }

  const data: Prisma.PaymentUpdateInput = {};
  const logs: { field: string; previousValue: string | null; newValue: string | null }[] = [];

  if (typeof input.paid === "boolean" && input.paid !== payment.paid) {
    data.paid = input.paid;
    data.paidAt = input.paid ? new Date() : null;
    logs.push({
      field: "paid",
      previousValue: String(payment.paid),
      newValue: String(input.paid),
    });
  }

  if (typeof input.notes === "string" && input.notes !== (payment.notes ?? "")) {
    data.notes = input.notes;
    logs.push({
      field: "notes",
      previousValue: payment.notes,
      newValue: input.notes,
    });
  }

  if (typeof input.description === "string" && input.description.trim() && input.description !== payment.description) {
    data.description = input.description.trim();
    logs.push({
      field: "description",
      previousValue: payment.description,
      newValue: input.description.trim(),
    });
  }

  if (typeof input.referenceNumber === "string" && input.referenceNumber !== (payment.referenceNumber ?? "")) {
    data.referenceNumber = input.referenceNumber;
    logs.push({
      field: "referenceNumber",
      previousValue: payment.referenceNumber,
      newValue: input.referenceNumber,
    });
  }

  if (typeof input.amount === "number") {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      const err = new Error("El monto debe ser un número mayor a 0");
      (err as Error & { code: string }).code = "BAD_REQUEST";
      throw err;
    }
    const prev = formatStoredAmount(payment.amount);
    const next = input.amount.toFixed(2);
    if (prev !== next) {
      data.amount = new Prisma.Decimal(next);
      logs.push({ field: "amount", previousValue: prev, newValue: next });
    }
  }

  if (typeof input.paymentDate === "string") {
    const d = parseCalendarDateInput(input.paymentDate);
    if (!d) {
      const err = new Error("Fecha de pago inválida");
      (err as Error & { code: string }).code = "BAD_REQUEST";
      throw err;
    }
    const prev = formatStoredDate(payment.paymentDate);
    const next = formatStoredDate(d);
    if (prev !== next) {
      data.paymentDate = d;
      logs.push({ field: "paymentDate", previousValue: prev, newValue: next });
    }
  }

  if (Object.keys(data).length === 0) {
    return serializeSinglePayment(payment);
  }

  data.updatedBy = { connect: { id: userId } };

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.payment.update({ where: { id: paymentId }, data });
    if (logs.length > 0) {
      await tx.paymentChangeLog.createMany({
        data: logs.map((l) => ({
          paymentId,
          field: l.field,
          previousValue: l.previousValue,
          newValue: l.newValue,
          changedById: userId,
        })),
      });
    }
    // Mantener alineada la fecha del gasto si el pago viene de Gastos
    if (payment.source === "EXPENSE" && payment.expenseId && logs.some((l) => l.field === "paymentDate")) {
      const dateLog = logs.find((l) => l.field === "paymentDate");
      if (dateLog?.newValue) {
        const d = parseCalendarDateInput(dateLog.newValue);
        if (d) {
          await tx.expense.update({
            where: { id: payment.expenseId },
            data: { paymentDate: d },
          });
        }
      }
    }
    return row;
  });

  return serializeSinglePayment(updated);
}
