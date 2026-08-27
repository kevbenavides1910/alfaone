import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, notFound, badRequest, noContent, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { updatePaymentWithAudit } from "@/modules/pagos/services/payment-update";

/**
 * API de un pago individual.
 *   PATCH /api/pagos/[id]  { paid?, amount?, paymentDate?, notes?, description?, referenceNumber? }
 *   DELETE /api/pagos/[id] → elimina un pago (solo MANUAL)
 */
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withPermission(
  async (req: NextRequest, ctx: { session: import("next-auth").Session; params: { id: string } }) => {
    try {
      const { id } = ctx.params;
      const body = await req.json();
      const userId = ctx.session.user?.id;
      if (!userId) return badRequest("Sesión sin usuario");

      const updated = await updatePaymentWithAudit(
        id,
        {
          paid: typeof body.paid === "boolean" ? body.paid : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
          description: typeof body.description === "string" ? body.description : undefined,
          referenceNumber: typeof body.referenceNumber === "string" ? body.referenceNumber : undefined,
          amount: typeof body.amount === "number" ? body.amount : undefined,
          paymentDate: typeof body.paymentDate === "string" ? body.paymentDate : undefined,
        },
        userId,
      );
      return ok(updated);
    } catch (e) {
      const code = e instanceof Error ? (e as Error & { code?: string }).code : undefined;
      if (code === "NOT_FOUND") return notFound("Pago no encontrado");
      if (code === "BAD_REQUEST") {
        return badRequest(e instanceof Error ? e.message : "Datos inválidos");
      }
      return serverError("Error al actualizar el pago", e);
    }
  },
  "pagos.calendario",
  "edit",
) as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const DELETE = withPermission(
  async (_req: NextRequest, ctx: { session: import("next-auth").Session; params: { id: string } }) => {
    try {
      const { id } = ctx.params;
      const payment = await prisma.payment.findUnique({ where: { id } });
      if (!payment) return notFound("Pago no encontrado");
      if (payment.source !== "MANUAL") {
        return badRequest("Solo se pueden eliminar pagos manuales");
      }
      await prisma.payment.delete({ where: { id } });
      return noContent();
    } catch (e) {
      return serverError("Error al eliminar el pago", e);
    }
  },
  "pagos.calendario",
  "edit",
) as (req: NextRequest, ctx: Ctx) => Promise<Response>;
