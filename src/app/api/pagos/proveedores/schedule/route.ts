import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import {
  ok,
  badRequest,
  notFound,
  conflict,
  serverError,
} from "@/lib/api/response";
import {
  scheduleExpensePayment,
  createPaymentFromProveedorExpenses,
  resolveProveedorExpenseGroupIds,
  stripBudgetMonthSuffix,
  ScheduleExpenseError,
} from "@/modules/pagos/services/pago-proveedores";
import { prisma } from "@/modules/core/db/prisma";

/**
 * POST /api/pagos/proveedores/schedule
 * { expenseId, paymentDate: YYYY-MM-DD, expenseIds?: string[] }
 * Asigna fecha. Si la OC está prorrateada en presupuesto, liquida todas las
 * rebanadas en un solo movimiento con el monto total.
 */
export const POST = withPermission(
  async (req: NextRequest, ctx: { session: import("next-auth").Session }) => {
    try {
      const body = await req.json();
      const expenseId = typeof body.expenseId === "string" ? body.expenseId.trim() : "";
      const paymentDate =
        typeof body.paymentDate === "string" ? body.paymentDate.trim() : "";
      if (!expenseId) return badRequest("expenseId requerido");
      if (!paymentDate) return badRequest("paymentDate requerido");

      const userId = ctx.session.user?.id;
      if (!userId) return badRequest("Sesión sin usuario");

      const fromBody: string[] = [];
      if (Array.isArray(body.expenseIds)) {
        for (const id of body.expenseIds) {
          if (typeof id === "string" && id.trim()) fromBody.push(id.trim());
        }
      }
      const groupIds =
        fromBody.length > 0
          ? [...new Set(fromBody)]
          : await resolveProveedorExpenseGroupIds(expenseId);

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
          expenses.find((e) => e.id === expenseId) ?? expenses[0];
        if (!primary) return notFound("Gasto no encontrado");

        const payment = await createPaymentFromProveedorExpenses({
          expenseIds: groupIds,
          paymentDate,
          userId,
          description: stripBudgetMonthSuffix(primary.description),
          amount: total,
          company: primary.company,
          notes: primary.notes,
          referenceNumber:
            primary.nafOcNoOrden?.trim() || primary.referenceNumber?.trim() || null,
        });
        return ok(payment);
      }

      const payment = await scheduleExpensePayment({
        expenseId,
        paymentDate,
        userId,
      });
      return ok(payment);
    } catch (e) {
      if (e instanceof ScheduleExpenseError) {
        if (e.code === "NOT_FOUND") return notFound(e.message);
        if (e.code === "CONFLICT") return conflict(e.message);
        return badRequest(e.message);
      }
      return serverError("Error al programar pago de proveedor", e);
    }
  },
  "pagos.calendario",
  "edit",
);
