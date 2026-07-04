import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canEditContractTab, canViewContractTab } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { contractBillingLineSchema } from "@/modules/presupuestos/validations/contract.schema";

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canViewContractTab(session, "administrations")) return forbidden();

  const { id: contractId } = await params;
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      select: { id: true },
    });
    if (!contract) return notFound();

    const rows = await prisma.contractBillingLine.findMany({
      where: { contractId },
      orderBy: [{ sortOrder: "asc" }, { lineCode: "asc" }],
    });

    return ok(rows.map(serialize));
  } catch (e) {
    return serverError("Error al obtener líneas de facturación", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canEditContractTab(session, "administrations")) return forbidden();

  const { id: contractId } = await params;
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      select: { id: true },
    });
    if (!contract) return notFound();

    const body = await req.json();
    const parsed = contractBillingLineSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const maxSort = await prisma.contractBillingLine.aggregate({
      where: { contractId },
      _max: { sortOrder: true },
    });
    const sortOrder = parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1;

    const row = await prisma.contractBillingLine.create({
      data: {
        contractId,
        lineCode: parsed.data.lineCode.trim(),
        description: parsed.data.description.trim(),
        monthlyAmount: parsed.data.monthlyAmount ?? null,
        sortOrder,
        createdById: session.user.id,
      },
    });

    return created(serialize(row));
  } catch (e) {
    return serverError("Error al crear línea de facturación", e);
  }
}
