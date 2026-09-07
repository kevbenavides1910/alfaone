/**
 * Pagos marcados Pagado sin gasto de presupuesto («Pendientes de asignar»).
 * Lista candidatos y crea el Expense reutilizando createExpenseTx + vínculo.
 */

import type { PrismaClient, PaymentSource } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { createExpenseTx } from "@/modules/presupuestos/services/create-expense";
import type { ExpenseCreateInput } from "@/modules/presupuestos/validations/expense.schema";
import { toMonthString } from "@/lib/utils/format";

export type PendingAssignPaymentDto = {
  id: string;
  source: PaymentSource;
  description: string;
  amount: number;
  paymentDate: string;
  company: string | null;
  referenceNumber: string | null;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  paidAt: string | null;
};

function startOfMonthUtc(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function endOfMonthUtc(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1));
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

const pendingWhere = {
  paid: true,
  expenseId: null,
  settledExpenses: { none: {} },
  sourceExpenses: { none: {} },
} as const;

export async function listPendingAssignPayments(options: {
  db: PrismaClient;
  month: string;
  company?: string | null;
  tenantCompany?: string | null;
}): Promise<PendingAssignPaymentDto[]> {
  const { db, month, company, tenantCompany } = options;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new PendingAssignError("BAD_REQUEST", "Mes inválido (YYYY-MM)");
  }

  const companyFilter = tenantCompany || company || undefined;
  const from = startOfMonthUtc(month);
  const to = endOfMonthUtc(month);

  const rows = await db.payment.findMany({
    where: {
      ...pendingWhere,
      paymentDate: { gte: from, lt: to },
      ...(companyFilter ? { company: companyFilter } : {}),
    },
    orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((p) => ({
    id: p.id,
    source: p.source,
    description: p.description,
    amount: parseFloat(p.amount.toString()),
    paymentDate: isoDate(p.paymentDate),
    company: p.company,
    referenceNumber: p.referenceNumber,
    category: p.category,
    subcategory: p.subcategory,
    notes: p.notes,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
  }));
}

export type AssignPaymentResult =
  | { ok: true; expenses: Array<{ id: string; sequentialNo: number; amount: number; description: string }>; count: number }
  | { ok: false; code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT"; message: string };

export class PendingAssignError extends Error {
  constructor(
    public code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "PendingAssignError";
  }
}

/**
 * Crea el gasto de presupuesto desde un pago pagado y lo saca de la cola.
 * El monto y la fecha de pago se toman del Payment (no del body).
 */
export async function assignPaymentAsExpense(options: {
  db: PrismaClient;
  paymentId: string;
  input: ExpenseCreateInput;
  createdById: string;
  tenantCompany?: string | null;
  /** Si true, la descripción del gasto es siempre la del Payment. */
  keepPaymentDescription?: boolean;
}): Promise<AssignPaymentResult> {
  const { db, paymentId, input, createdById, tenantCompany, keepPaymentDescription } = options;

  try {
    return await db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          settledExpenses: { select: { id: true }, take: 1 },
          sourceExpenses: { select: { id: true }, take: 1 },
        },
      });

      if (!payment) {
        return { ok: false, code: "NOT_FOUND", message: "Pago no encontrado" };
      }
      if (!payment.paid) {
        return { ok: false, code: "BAD_REQUEST", message: "El pago no está marcado como Pagado" };
      }
      if (payment.expenseId || payment.settledExpenses.length > 0 || payment.sourceExpenses.length > 0) {
        return {
          ok: false,
          code: "CONFLICT",
          message: "Este pago ya está vinculado a un gasto de presupuesto",
        };
      }

      if (tenantCompany && payment.company && payment.company !== tenantCompany) {
        return { ok: false, code: "BAD_REQUEST", message: "No puede asignar pagos de otra empresa" };
      }

      const amount = parseFloat(payment.amount.toString());
      if (!(amount > 0)) {
        return { ok: false, code: "BAD_REQUEST", message: "El monto del pago no es válido" };
      }

      const paymentDateStr = isoDate(payment.paymentDate);
      const periodMonth =
        input.periodMonth?.trim() ||
        `${paymentDateStr.slice(0, 7)}-01`;

      const originNote = `Origen: pago ${payment.source} ${payment.id.slice(0, 8)}`;
      const notes = [input.notes?.trim(), originNote].filter(Boolean).join("\n");

      const description = keepPaymentDescription
        ? payment.description
        : input.description?.trim() || payment.description;

      // Reparto manual: proporciones del template aplicadas al monto de este pago.
      let deferredManualAllocations = input.deferredManualAllocations;
      if (deferredManualAllocations?.length) {
        const templateTotal = deferredManualAllocations.reduce((s, r) => s + r.amount, 0);
        if (templateTotal > 0 && Math.abs(templateTotal - amount) > 0.02) {
          const scaled = deferredManualAllocations.map((r) => ({
            contractId: r.contractId,
            amount: Math.round(((r.amount / templateTotal) * amount + Number.EPSILON) * 100) / 100,
          }));
          const scaledSum = scaled.reduce((s, r) => s + r.amount, 0);
          const drift = Math.round((amount - scaledSum + Number.EPSILON) * 100) / 100;
          if (scaled.length > 0 && drift !== 0) {
            scaled[scaled.length - 1] = {
              ...scaled[scaled.length - 1]!,
              amount: Math.round((scaled[scaled.length - 1]!.amount + drift + Number.EPSILON) * 100) / 100,
            };
          }
          deferredManualAllocations = scaled;
        }
      }

      const forcedInput: ExpenseCreateInput = {
        ...input,
        amount,
        paymentDate: paymentDateStr,
        periodMonth,
        company: input.company || payment.company || "",
        referenceNumber: input.referenceNumber?.trim() || payment.referenceNumber || undefined,
        description,
        notes: notes || undefined,
        ...(deferredManualAllocations ? { deferredManualAllocations } : {}),
      };

      if (!forcedInput.company) {
        return { ok: false, code: "BAD_REQUEST", message: "Seleccione la empresa del gasto" };
      }

      if (forcedInput.deferredManualAllocations?.length) {
        const sum = forcedInput.deferredManualAllocations.reduce((s, r) => s + r.amount, 0);
        if (Math.abs(sum - amount) > 0.02 + 1e-9) {
          return {
            ok: false,
            code: "BAD_REQUEST",
            message: "La suma de montos por contrato debe igualar el monto del pago (±¢2)",
          };
        }
      }

      let created;
      try {
        created = await createExpenseTx(tx, forcedInput, createdById, tenantCompany);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error al crear gasto";
        throw new PendingAssignError("BAD_REQUEST", msg);
      }

      const ids = created.expenses.map((e) => e.id);
      const primaryId = ids[0];
      if (!primaryId) {
        throw new PendingAssignError("BAD_REQUEST", "No se creó ningún gasto");
      }

      await tx.expense.updateMany({
        where: { id: { in: ids } },
        data: { sourcePaymentId: paymentId },
      });

      await tx.payment.update({
        where: { id: paymentId },
        data: { expenseId: primaryId },
      });

      return {
        ok: true as const,
        count: created.count,
        expenses: created.expenses.map((e) => ({
          id: e.id,
          sequentialNo: e.sequentialNo,
          amount: parseFloat(e.amount.toString()),
          description: e.description,
        })),
      };
    });
  } catch (e) {
    if (e instanceof PendingAssignError) {
      return { ok: false, code: e.code, message: e.message };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, code: "CONFLICT", message: "Conflicto al vincular el pago" };
    }
    throw e;
  }
}

export type AssignPaymentsBatchResult = {
  ok: true;
  assigned: number;
  failed: Array<{ paymentId: string; message: string }>;
  expensesCreated: number;
};

/**
 * Asigna varios pagos con la misma clasificación/distribución.
 * Cada pago conserva su monto y descripción; el reparto manual se escala por monto.
 */
export async function assignPaymentsAsExpenseBatch(options: {
  db: PrismaClient;
  paymentIds: string[];
  input: ExpenseCreateInput;
  createdById: string;
  tenantCompany?: string | null;
}): Promise<AssignPaymentsBatchResult | { ok: false; code: "BAD_REQUEST"; message: string }> {
  const ids = [...new Set(options.paymentIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, code: "BAD_REQUEST", message: "Seleccione al menos un pago" };
  }
  if (ids.length > 100) {
    return { ok: false, code: "BAD_REQUEST", message: "Máximo 100 pagos por lote" };
  }

  let assigned = 0;
  let expensesCreated = 0;
  const failed: Array<{ paymentId: string; message: string }> = [];

  for (const paymentId of ids) {
    const result = await assignPaymentAsExpense({
      ...options,
      paymentId,
      keepPaymentDescription: ids.length > 1,
    });
    if (result.ok) {
      assigned += 1;
      expensesCreated += result.count;
    } else {
      failed.push({ paymentId, message: result.message });
    }
  }

  return { ok: true, assigned, failed, expensesCreated };
}

/** Prefill helpers for UI / Syntra. */
export function suggestPeriodMonthFromPaymentDate(paymentDateIso: string): string {
  return toMonthString(new Date(`${paymentDateIso.slice(0, 10)}T12:00:00`));
}
