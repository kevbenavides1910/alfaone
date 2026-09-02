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
  ScheduleExpenseError,
} from "@/modules/pagos/services/pago-proveedores";

/**
 * POST /api/pagos/proveedores/schedule
 * { expenseId, paymentDate: YYYY-MM-DD }
 * Asigna fecha y crea Payment EXPENSE para el calendario diario.
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
