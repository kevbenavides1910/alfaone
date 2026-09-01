import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, notFound, serverError } from "@/lib/api/response";
import { listContractPositionsByZone, listManualContractLocations } from "@/modules/presupuestos/services/contract-positions-catalog";

type Ctx = { params: Promise<{ id: string }> };

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

    const [groups, locations] = await Promise.all([
      listContractPositionsByZone(contractId),
      listManualContractLocations(contractId),
    ]);

    return ok({
      groups,
      locations: locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        description: loc.description,
        positionsCount: loc.positions.length,
      })),
    });
  } catch (e) {
    return serverError("Error al obtener puestos por zona", e);
  }
}
