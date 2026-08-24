import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, notFound, badRequest, noContent, serverError } from "@/lib/api/response";
import { serializeSinglePayment } from "@/modules/pagos/services/pagos";

/**
 * API de un pago individual.
 *   PATCH /api/pagos/[id]  { paid: boolean, notes?, description?, referenceNumber? }
 *   DELETE /api/pagos/[id] → elimina un pago (solo MANUAL)
 */
type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withPermission(
  async (req: NextRequest, ctx: { session: import("next-auth").Session; params: { id: string } }) => {
    try {
      const { id } = ctx.params;
      const body = await req.json();

      const payment = await prisma.payment.findUnique({ where: { id } });
      if (!payment) return notFound("Pago no encontrado");

      const data: Record<string, unknown> = {};
      if (typeof body.paid === "boolean") {
        data.paid = body.paid;
        data.paidAt = body.paid ? new Date() : null;
      }
      if (typeof body.notes === "string") data.notes = body.notes;
      if (typeof body.description === "string") data.description = body.description;
      if (typeof body.referenceNumber === "string") {
        data.referenceNumber = body.referenceNumber;
      }
      // Solo permitir cambio de monto/fecha en pagos manuales
      if (payment.source === "MANUAL") {
        if (typeof body.amount === "number" && body.amount > 0) data.amount = body.amount;
        if (typeof body.paymentDate === "string") {
          const d = new Date(body.paymentDate + "T00:00:00Z");
          if (!Number.isNaN(d.getTime())) data.paymentDate = d;
        }
      }

      const updated = await prisma.payment.update({ where: { id }, data });
      return ok(serializeSinglePayment(updated));
    } catch (e) {
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