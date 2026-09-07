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
  PendingAssignError,
} from "@/modules/presupuestos/services/pending-assign-payments";

const paymentIdSchema = z.object({
  paymentId: z.string().min(1, "paymentId requerido"),
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
 * Crea gasto (contrato / diferido / personalizado) desde un pago pagado.
 */
export const POST = withPermission(async (req: NextRequest, { session }) => {
  if (!canManageExpenses(session)) return forbidden();

  try {
    const body = await req.json();
    const idParsed = paymentIdSchema.safeParse(body);
    if (!idParsed.success) {
      return badRequest("paymentId requerido", idParsed.error.flatten());
    }
    const parsed = expenseCreateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Datos inválidos", parsed.error.flatten());
    }

    const result = await assignPaymentAsExpense({
      db: dbForSession(session),
      paymentId: idParsed.data.paymentId,
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
  } catch (e) {
    return serverError("Error al asignar pago como gasto", e);
  }
}, "gastos.expenses", "edit");
