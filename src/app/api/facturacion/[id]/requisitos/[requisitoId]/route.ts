import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";

type Ctx = { params: Promise<{ id: string; requisitoId: string }> };

const toggleSchema = z.object({
  completed: z.boolean(),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "edit")) return forbidden();

  const { id: facturaId, requisitoId } = await params;

  try {
    const body = await req.json();
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const factura = await prisma.facturaMensual.findUnique({
      where: { id: facturaId },
      select: { status: true },
    });
    if (!factura) return notFound("Factura mensual no encontrada");
    if (factura.status === "FACTURADO" || factura.status === "COBRADO") {
      return badRequest("No se pueden modificar requisitos de una factura cerrada");
    }

    const requisito = await prisma.facturaRequisito.findFirst({
      where: { id: requisitoId, facturaMensualId: facturaId },
    });
    if (!requisito) return notFound("Requisito no encontrado");
    if (requisito.requiresEvidenceCopied) {
      return badRequest("Este requisito requiere adjuntar evidencia");
    }

    const updated = await prisma.facturaRequisito.update({
      where: { id: requisitoId },
      data: {
        status: parsed.data.completed ? "COMPLETADO" : "PENDIENTE",
      },
      select: { id: true, status: true },
    });

    return ok({
      id: updated.id,
      status: updated.status,
      isComplete: updated.status === "COMPLETADO",
    });
  } catch (e) {
    return serverError("Error al actualizar requisito", e);
  }
}
