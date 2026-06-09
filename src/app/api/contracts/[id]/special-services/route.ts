import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { specialServiceSchema } from "@/modules/presupuestos/validations/contract.schema";

type Ctx = { params: Promise<{ id: string }> };

function toMonthDate(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function serialize(row: {
  id: string;
  periodMonth: Date;
  description: string;
  amount: unknown;
  startDate: Date;
  endDate: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    periodMonth: row.periodMonth.toISOString(),
    description: row.description,
    amount: parseFloat(String(row.amount)),
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    notes: row.notes,
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

    const rows = await prisma.contractSpecialService.findMany({
      where: { contractId },
      orderBy: [{ periodMonth: "desc" }, { startDate: "desc" }],
    });

    return ok(rows.map(serialize));
  } catch (e) {
    return serverError("Error al obtener servicios especiales", e);
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
    const parsed = specialServiceSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await prisma.contractSpecialService.create({
      data: {
        contractId,
        periodMonth: toMonthDate(parsed.data.periodMonth),
        description: parsed.data.description.trim(),
        amount: parsed.data.amount,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        notes: parsed.data.notes?.trim() || null,
        createdById: session.user.id,
      },
    });

    return created(serialize(row));
  } catch (e) {
    return serverError("Error al registrar servicio especial", e);
  }
}
