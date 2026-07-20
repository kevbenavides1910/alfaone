import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { billingRequirementUpdateSchema } from "@/modules/presupuestos/validations/contract.schema";

type Ctx = { params: Promise<{ id: string; requirementId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id: contractId, requirementId } = await params;
  try {
    const existing = await prisma.contractBillingRequirement.findFirst({
      where: { id: requirementId, contractId },
    });
    if (!existing) return notFound();

    const body = await req.json();
    const parsed = billingRequirementUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const data: {
      description?: string;
      notes?: string | null;
      requiresEvidence?: boolean;
      sortOrder?: number;
    } = {};
    if (parsed.data.description !== undefined) data.description = parsed.data.description.trim();
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes?.trim() || null;
    if (parsed.data.requiresEvidence !== undefined) data.requiresEvidence = parsed.data.requiresEvidence;
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

    const updated = await prisma.contractBillingRequirement.update({
      where: { id: requirementId },
      data,
    });

    if (parsed.data.requiresEvidence !== undefined) {
      await prisma.facturaRequisito.updateMany({
        where: {
          requirementName: existing.description,
          facturaMensual: {
            contractId,
            status: { notIn: ["FACTURADO", "COBRADO"] },
          },
        },
        data: { requiresEvidenceCopied: updated.requiresEvidence },
      });
    }

    return ok({
      id: updated.id,
      description: updated.description,
      notes: updated.notes,
      requiresEvidence: updated.requiresEvidence,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al actualizar requisito de facturación", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id: contractId, requirementId } = await params;
  try {
    const existing = await prisma.contractBillingRequirement.findFirst({
      where: { id: requirementId, contractId },
    });
    if (!existing) return notFound();

    await prisma.contractBillingRequirement.delete({ where: { id: requirementId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar requisito de facturación", e);
  }
}
