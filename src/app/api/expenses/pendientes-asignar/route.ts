import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, created, badRequest, notFound, conflict, serverError, forbidden } from "@/lib/api/response";
import { canManageExpenses } from "@/lib/api/middleware";
import { dbForSession } from "@/modules/core/db/db-for-session";
import { expenseCreateSchema } from "@/modules/presupuestos/validations/expense.schema";
import {
  listPendingAssignPayments,
  assignPaymentAsExpense,
  assignPaymentsAsExpenseBatch,
  PendingAssignError,
} from "@/modules/presupuestos/services/pending-assign-payments";

const paymentIdSchema = z.object({
  paymentId: z.string().min(1).optional(),
  paymentIds: z.array(z.string().min(1)).min(1).max(100).optional(),
});

/**
 * GET /api/expenses/pendientes-asignar?month=YYYY-MM&company=
 * Pagos marcados Pagado del mes sin gasto de presupuesto.
 */
export const GET = withPermission(async (req: NextRequest, { session }) => {
  try {
    const month = req.nextUrl.searchParams.get("month")?.trim() || "";
    const company = req.nextUrl.searchParams.get("company")?.trim() || undefined;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return badRequest("Parámetro month requerido (YYYY-MM)");
    }

    const data = await listPendingAssignPayments({
      db: dbForSession(session),
      month,
      company,
      tenantCompany: session.user.company,
    });
    return ok(data);
  } catch (e) {
    if (e instanceof PendingAssignError) {
      return badRequest(e.message);
    }
    return serverError("Error al listar pendientes de asignar", e);
  }
}, "gastos.expenses", "view");

/**
 * POST /api/expenses/pendientes-asignar
 * Crea gasto(s) desde uno o varios pagos pagados (misma clasificación/distribución).
 * Body: { paymentId } o { paymentIds: string[] } + ExpenseCreateInput.
 */
export const POST = withPermission(async (req: NextRequest, { session }) => {
  if (!canManageExpenses(session)) return forbidden();

  try {
    const body = await req.json();
    const idParsed = paymentIdSchema.safeParse(body);
    if (!idParsed.success) {
      return badRequest("paymentId o paymentIds requerido", idParsed.error.flatten());
    }

    const paymentIds =
      idParsed.data.paymentIds?.length
        ? idParsed.data.paymentIds
        : idParsed.data.paymentId
          ? [idParsed.data.paymentId]
          : [];
    if (paymentIds.length === 0) {
      return badRequest("paymentId o paymentIds requerido");
    }

    const parsed = expenseCreateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Datos inválidos", parsed.error.flatten());
    }

    if (paymentIds.length === 1) {
      const result = await assignPaymentAsExpense({
        db: dbForSession(session),
        paymentId: paymentIds[0]!,
        input: parsed.data,
        createdById: session.user.id,
        tenantCompany: session.user.company,
      });

      if (!result.ok) {
        if (result.code === "NOT_FOUND") return notFound(result.message);
        if (result.code === "CONFLICT") return conflict(result.message);
        return badRequest(result.message);
      }

      return created(result);
    }

    const batch = await assignPaymentsAsExpenseBatch({
      db: dbForSession(session),
      paymentIds,
      input: parsed.data,
      createdById: session.user.id,
      tenantCompany: session.user.company,
    });

    if (!batch.ok) {
      return badRequest(batch.message);
    }

    return created(batch);
  } catch (e) {
    return serverError("Error al asignar pago como gasto", e);
  }
}, "gastos.expenses", "edit");
