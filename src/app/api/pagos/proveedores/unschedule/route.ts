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
  unschedulePaymentFromDaily,
  ScheduleExpenseError,
} from "@/modules/pagos/services/pago-proveedores";

/**
 * POST /api/pagos/proveedores/unschedule
 * { paymentId?: string, expenseId?: string }
 * Quita el pago del calendario diario y lo deja otra vez «Sin programar»
 * en Pago proveedores (solo si aún no está marcado pagado).
 */
export const POST = withPermission(
  async (req: NextRequest, ctx: { session: import("next-auth").Session }) => {
    try {
      const body = await req.json();
      const paymentId =
        typeof body.paymentId === "string" ? body.paymentId.trim() : "";
      const expenseId =
        typeof body.expenseId === "string" ? body.expenseId.trim() : "";
      if (!paymentId && !expenseId) {
        return badRequest("Se requiere paymentId o expenseId");
      }

      const userId = ctx.session.user?.id;
      if (!userId) return badRequest("Sesión sin usuario");

      const result = await unschedulePaymentFromDaily({
        paymentId: paymentId || undefined,
        expenseId: expenseId || undefined,
        userId,
      });
      return ok(result);
    } catch (e) {
      if (e instanceof ScheduleExpenseError) {
        if (e.code === "NOT_FOUND") return notFound(e.message);
        if (e.code === "CONFLICT") return conflict(e.message);
        return badRequest(e.message);
      }
      return serverError("Error al desasignar pago del calendario", e);
    }
  },
  "pagos.calendario",
  "edit",
);
