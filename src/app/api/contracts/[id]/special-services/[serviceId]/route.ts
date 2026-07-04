import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { specialServiceUpdateSchema } from "@/modules/presupuestos/validations/contract.schema";

type Ctx = { params: Promise<{ id: string; serviceId: string }> };

function toMonthDate(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id: contractId, serviceId } = await params;
  try {
    const existing = await prisma.contractSpecialService.findFirst({
      where: { id: serviceId, contractId },
    });
    if (!existing) return notFound();

    const body = await req.json();
    const parsed = specialServiceUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    if (parsed.data.startDate !== undefined && parsed.data.endDate !== undefined) {
      if (new Date(parsed.data.endDate) < new Date(parsed.data.startDate)) {
        return badRequest("La fecha fin debe ser igual o posterior a la fecha inicio");
      }
    } else if (parsed.data.endDate !== undefined && new Date(parsed.data.endDate) < existing.startDate) {
      return badRequest("La fecha fin debe ser igual o posterior a la fecha inicio");
    } else if (parsed.data.startDate !== undefined && existing.endDate < new Date(parsed.data.startDate)) {
      return badRequest("La fecha fin debe ser igual o posterior a la fecha inicio");
    }

    const data: {
      periodMonth?: Date;
      description?: string;
      amount?: number;
      startDate?: Date;
      endDate?: Date;
      notes?: string | null;
    } = {};

    if (parsed.data.periodMonth !== undefined) data.periodMonth = toMonthDate(parsed.data.periodMonth);
    if (parsed.data.description !== undefined) data.description = parsed.data.description.trim();
    if (parsed.data.amount !== undefined) data.amount = parsed.data.amount;
    if (parsed.data.startDate !== undefined) data.startDate = new Date(parsed.data.startDate);
    if (parsed.data.endDate !== undefined) data.endDate = new Date(parsed.data.endDate);
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes?.trim() || null;

    const updated = await prisma.contractSpecialService.update({
      where: { id: serviceId },
      data,
    });

    return ok({
      id: updated.id,
      periodMonth: updated.periodMonth.toISOString(),
      description: updated.description,
      amount: parseFloat(String(updated.amount)),
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al actualizar servicio especial", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id: contractId, serviceId } = await params;
  try {
    const existing = await prisma.contractSpecialService.findFirst({
      where: { id: serviceId, contractId },
    });
    if (!existing) return notFound();

    await prisma.contractSpecialService.delete({ where: { id: serviceId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar servicio especial", e);
  }
}
