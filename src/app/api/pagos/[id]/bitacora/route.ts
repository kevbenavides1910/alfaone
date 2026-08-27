import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, notFound, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { listPaymentChangeLogs } from "@/modules/pagos/services/payment-update";

/**
 * GET /api/pagos/[id]/bitacora — historial de cambios del pago.
 */
type Ctx = { params: Promise<{ id: string }> };

export const GET = withPermission(
  async (_req: NextRequest, ctx: { session: import("next-auth").Session; params: { id: string } }) => {
    try {
      const { id } = ctx.params;
      const payment = await prisma.payment.findUnique({ where: { id }, select: { id: true } });
      if (!payment) return notFound("Pago no encontrado");
      const logs = await listPaymentChangeLogs(id);
      return ok(logs);
    } catch (e) {
      return serverError("Error al obtener la bitácora del pago", e);
    }
  },
  "pagos.calendario",
  "view",
) as (req: NextRequest, ctx: Ctx) => Promise<Response>;
