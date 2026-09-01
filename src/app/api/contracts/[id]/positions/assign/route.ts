import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { z } from "zod";
import { assignPositionsToLocation } from "@/modules/presupuestos/services/contract-positions-catalog";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  positionIds: z.array(z.string().min(1)).min(1),
  locationId: z.string().min(1).nullable(),
});

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
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await assignPositionsToLocation({
      contractId,
      positionIds: parsed.data.positionIds,
      locationId: parsed.data.locationId,
    });
    return ok(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al asignar puestos";
    return badRequest(message);
  }
}
