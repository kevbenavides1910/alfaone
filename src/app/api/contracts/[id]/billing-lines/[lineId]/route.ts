import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canEditContractTab, canViewContractTab } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { contractBillingLineUpdateSchema } from "@/modules/presupuestos/validations/contract.schema";

type Ctx = { params: Promise<{ id: string; lineId: string }> };

function serialize(row: {
  id: string;
  lineCode: string;
  description: string;
  monthlyAmount: { toString(): string } | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    lineCode: row.lineCode,
    description: row.description,
    monthlyAmount: row.monthlyAmount ? parseFloat(row.monthlyAmount.toString()) : null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canEditContractTab(session, "administrations")) return forbidden();

  const { id: contractId, lineId } = await params;
  try {
    const existing = await prisma.contractBillingLine.findFirst({
      where: { id: lineId, contractId },
    });
    if (!existing) return notFound();

    const body = await req.json();
    const parsed = contractBillingLineUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const updated = await prisma.contractBillingLine.update({
      where: { id: lineId },
      data: {
        ...(parsed.data.lineCode !== undefined ? { lineCode: parsed.data.lineCode.trim() } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description.trim() } : {}),
        ...(parsed.data.monthlyAmount !== undefined
          ? { monthlyAmount: parsed.data.monthlyAmount ?? null }
          : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      },
    });

    return ok(serialize(updated));
  } catch (e) {
    return serverError("Error al actualizar línea de facturación", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canEditContractTab(session, "administrations")) return forbidden();

  const { id: contractId, lineId } = await params;
  try {
    const existing = await prisma.contractBillingLine.findFirst({
      where: { id: lineId, contractId },
    });
    if (!existing) return notFound();

    await prisma.contractBillingLine.delete({ where: { id: lineId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar línea de facturación", e);
  }
}
