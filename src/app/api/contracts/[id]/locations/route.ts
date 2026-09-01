import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const createLocationSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

import { listManualContractLocations } from "@/modules/presupuestos/services/contract-positions-catalog";

function serializeShift(s: { id: string; label: string | null; hours: unknown; sortOrder: number }) {
  return {
    ...s,
    hours: parseFloat(String(s.hours)),
  };
}

function serializePosition(
  p: {
    id: string;
    name: string;
    description: string | null;
    zone?: { id: string; name: string } | null;
    shifts: { id: string; label: string | null; hours: unknown; sortOrder: number }[];
    expenses: {
      id: string;
      amount: unknown;
      type: string;
      description: string;
      periodMonth: Date;
    }[];
  }
) {
  const expenses = p.expenses.map((e) => ({
    id: e.id,
    type: e.type,
    description: e.description,
    periodMonth: e.periodMonth.toISOString(),
    amount: parseFloat(String(e.amount)),
  }));
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    zone: p.zone ?? null,
    shifts: p.shifts.map(serializeShift),
    totalExpenses,
    expenses,
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

    const locations = await listManualContractLocations(contractId);

    const data = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      description: loc.description,
      sortOrder: loc.sortOrder,
      positions: loc.positions.map((p) => serializePosition(p)),
    }));

    return ok(data);
  } catch (e) {
    return serverError("Error al obtener ubicaciones", e);
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
    const parsed = createLocationSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const maxSort = await prisma.contractLocation.aggregate({
      where: { contractId },
      _max: { sortOrder: true },
    });
    const sortOrder = parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1;

    const loc = await prisma.contractLocation.create({
      data: {
        contractId,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        sortOrder,
      },
    });

    return created(loc);
  } catch (e) {
    return serverError("Error al crear ubicación", e);
  }
}
