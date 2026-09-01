import { prisma } from "@/modules/core/db/prisma";

export async function assignPositionsToLocation(options: {
  contractId: string;
  positionIds: string[];
  locationId: string | null;
}): Promise<{ updated: number }> {
  const { contractId, positionIds, locationId } = options;
  if (positionIds.length === 0) return { updated: 0 };

  if (locationId) {
    const loc = await prisma.contractLocation.findFirst({
      where: {
        id: locationId,
        contractId,
        nafSyncGroupKey: null,
        nafUbicacionCode: null,
      },
    });
    if (!loc) throw new Error("Ubicación no encontrada en este contrato");
  }

  const positions = await prisma.position.findMany({
    where: { id: { in: positionIds }, contractId },
    select: { id: true },
  });
  if (positions.length !== positionIds.length) {
    throw new Error("Uno o más puestos no pertenecen al contrato");
  }

  const result = await prisma.position.updateMany({
    where: { id: { in: positionIds }, contractId },
    data: { locationId },
  });

  return { updated: result.count };
}

export type CatalogPositionRow = {
  id: string;
  name: string;
  nafUbicacionCode: string | null;
  contract: { id: string; licitacionNo: string; client: string; company: string };
  zone: { id: string; name: string } | null;
  zoneId: string | null;
  location: { id: string; name: string } | null;
  locationId: string | null;
};

export async function listCatalogPositions(filters?: {
  zoneId?: string | null;
  unassigned?: boolean;
  contractId?: string;
  q?: string;
}): Promise<CatalogPositionRow[]> {
  const where: {
    contract: { deletedAt: null };
    zoneId?: string | null;
    locationId?: null;
    contractId?: string;
  } = { contract: { deletedAt: null } };

  if (filters?.contractId) where.contractId = filters.contractId;
  if (filters?.unassigned) where.locationId = null;
  else if (filters?.zoneId === "NONE") where.zoneId = null;
  else if (filters?.zoneId) where.zoneId = filters.zoneId;

  const rows = await prisma.position.findMany({
    where,
    include: {
      contract: { select: { id: true, licitacionNo: true, client: true, company: true } },
      zone: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: [{ contract: { client: "asc" } }, { name: "asc" }],
    take: 2000,
  });

  let data: CatalogPositionRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    nafUbicacionCode: p.nafUbicacionCode,
    contract: p.contract,
    zone: p.zone,
    zoneId: p.zoneId,
    location: p.location,
    locationId: p.locationId,
  }));

  const q = filters?.q?.trim().toLowerCase();
  if (q) {
    data = data.filter((d) =>
      [d.name, d.nafUbicacionCode ?? "", d.contract.client, d.contract.licitacionNo, d.zone?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  return data;
}

export type PositionsByZoneGroup = {
  zoneId: string | null;
  zoneName: string;
  positions: CatalogPositionRow[];
};

export async function listContractPositionsByZone(contractId: string): Promise<PositionsByZoneGroup[]> {
  const positions = await listCatalogPositions({ contractId });
  const groups = new Map<string, PositionsByZoneGroup>();

  for (const p of positions) {
    const key = p.zoneId ?? "__sin__";
    if (!groups.has(key)) {
      groups.set(key, {
        zoneId: p.zoneId,
        zoneName: p.zone?.name ?? "Sin zona operativa",
        positions: [],
      });
    }
    groups.get(key)!.positions.push(p);
  }

  return Array.from(groups.values()).sort((a, b) => a.zoneName.localeCompare(b.zoneName, "es"));
}

/** Ubicaciones manuales del contrato (excluye import/sync automático). */
export async function listManualContractLocations(contractId: string) {
  return prisma.contractLocation.findMany({
    where: {
      contractId,
      nafSyncGroupKey: null,
      nafUbicacionCode: null,
    },
    include: {
      positions: {
        orderBy: { name: "asc" },
        include: {
          zone: { select: { id: true, name: true } },
          shifts: { orderBy: { sortOrder: "asc" } },
          expenses: {
            select: { id: true, amount: true, type: true, description: true, periodMonth: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}
