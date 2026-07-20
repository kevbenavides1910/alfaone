import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { billingRequirementSchema } from "@/modules/presupuestos/validations/contract.schema";
import { syncOpenFacturaRequisitosForContract } from "@/modules/presupuestos/services/facturacion-cobro";

type Ctx = { params: Promise<{ id: string }> };

function serialize(row: {
  id: string;
  description: string;
  notes: string | null;
  requiresEvidence: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    description: row.description,
    notes: row.notes,
    requiresEvidence: row.requiresEvidence,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: contractId } = await params;
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      select: { id: true },
    });
    if (!contract) return notFound();

    const rows = await prisma.contractBillingRequirement.findMany({
      where: { contractId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return ok(rows.map(serialize));
  } catch (e) {
    return serverError("Error al obtener requisitos de facturación", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id: contractId } = await params;
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      select: { id: true },
    });
    if (!contract) return notFound();

    const body = await req.json();
    const parsed = billingRequirementSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const maxSort = await prisma.contractBillingRequirement.aggregate({
      where: { contractId },
      _max: { sortOrder: true },
    });
    const sortOrder = parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1;

    const row = await prisma.contractBillingRequirement.create({
      data: {
        contractId,
        description: parsed.data.description.trim(),
        notes: parsed.data.notes?.trim() || null,
        requiresEvidence: parsed.data.requiresEvidence ?? true,
        sortOrder,
        createdById: session.user.id,
      },
    });

    await syncOpenFacturaRequisitosForContract(prisma, contractId);

    return created(serialize(row));
  } catch (e) {
    return serverError("Error al crear requisito de facturación", e);
  }
}
