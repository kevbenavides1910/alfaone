import { prisma } from "@/modules/core/db/prisma";
import {
  assetImeiFromAttributes,
  findPhoneAssetAtPosition,
  listAllInventoryPhones,
  type InventoryPhoneRow,
} from "@/modules/syntra/services/patrol-inventory-phone-service";
import { ensurePatrolDeviceForPhoneAsset } from "@/modules/syntra/services/patrol-device-sync-service";

export type RoutePhoneRow = {
  id: string;
  assetId: string;
  isPrimary: boolean;
  imei: string;
  phoneLabel: string;
  positionName: string | null;
  locationName: string | null;
  contractName: string | null;
};

async function enrichRoutePhones(
  rows: { id: string; assetId: string; isPrimary: boolean }[],
): Promise<RoutePhoneRow[]> {
  if (rows.length === 0) return [];

  const assets = await prisma.asset.findMany({
    where: { id: { in: rows.map((r) => r.assetId) } },
    include: {
      currentPosition: {
        include: {
          location: { include: { contract: true } },
        },
      },
    },
  });
  const byId = new Map(assets.map((a) => [a.id, a]));

  return rows.map((row) => {
    const asset = byId.get(row.assetId);
    return {
      id: row.id,
      assetId: row.assetId,
      isPrimary: row.isPrimary,
      imei: asset ? assetImeiFromAttributes(asset.attributes) : "",
      phoneLabel: asset?.name?.trim() || asset?.code || row.assetId,
      positionName: asset?.currentPosition?.name ?? null,
      locationName: asset?.currentPosition?.location?.name ?? null,
      contractName: asset?.currentPosition?.location?.contract?.client ?? null,
    };
  });
}

export async function getRoutePhones(routeId: string): Promise<RoutePhoneRow[]> {
  const rows = await prisma.patrolRoutePhone.findMany({
    where: { routeId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { id: true, assetId: true, isPrimary: true },
  });
  return enrichRoutePhones(rows);
}

export async function syncPrimaryPhoneForRoute(routeId: string, positionId: string | null) {
  if (!positionId) {
    await prisma.patrolRoutePhone.deleteMany({ where: { routeId, isPrimary: true } });
    return;
  }

  const phone = await findPhoneAssetAtPosition(positionId);
  if (!phone) return;

  await prisma.$transaction(async (tx) => {
    await tx.patrolRoutePhone.updateMany({
      where: { routeId, isPrimary: true },
      data: { isPrimary: false },
    });

    await tx.patrolRoutePhone.upsert({
      where: { routeId_assetId: { routeId, assetId: phone.id } },
      create: { routeId, assetId: phone.id, isPrimary: true },
      update: { isPrimary: true },
    });
  });

  if (phone.currentPosition) {
    await ensurePatrolDeviceForPhoneAsset(phone);
  }
}

export async function addAuthorizedPhone(
  routeId: string,
  assetId: string,
  options?: { isPrimary?: boolean },
) {
  const route = await prisma.patrolRoute.findUnique({
    where: { id: routeId },
    include: { position: { select: { name: true } } },
  });
  if (!route) throw new Error("ROUTE_NOT_FOUND");

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      type: true,
      currentPosition: { include: { location: { include: { contract: true } } } },
    },
  });
  if (!asset || asset.type.code !== "PHONE" || asset.status === "RETIRED") {
    throw new Error("INVALID_PHONE");
  }

  const imei = assetImeiFromAttributes(asset.attributes);
  if (!imei) throw new Error("PHONE_WITHOUT_IMEI");

  const makePrimary = options?.isPrimary === true;

  const row = await prisma.$transaction(async (tx) => {
    if (makePrimary) {
      await tx.patrolRoutePhone.updateMany({
        where: { routeId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return tx.patrolRoutePhone.upsert({
      where: { routeId_assetId: { routeId, assetId } },
      create: { routeId, assetId, isPrimary: makePrimary },
      update: makePrimary ? { isPrimary: true } : {},
    });
  });

  await ensurePatrolDeviceForPhoneAsset(asset, {
    positionId: route.positionId,
    locationDesc: route.position?.name ?? asset.currentPosition?.name ?? asset.name ?? asset.code,
  });

  const [enriched] = await enrichRoutePhones([row]);
  return enriched;
}

export async function removeAuthorizedPhone(routeId: string, phoneRowId: string) {
  const row = await prisma.patrolRoutePhone.findFirst({
    where: { id: phoneRowId, routeId },
  });
  if (!row) throw new Error("PHONE_NOT_FOUND");

  if (row.isPrimary) {
    const total = await prisma.patrolRoutePhone.count({ where: { routeId } });
    if (total <= 1) {
      throw new Error("CANNOT_REMOVE_ONLY_PRIMARY");
    }
  }

  await prisma.patrolRoutePhone.delete({ where: { id: phoneRowId } });
}

export async function setPrimaryPhone(routeId: string, phoneRowId: string) {
  const row = await prisma.patrolRoutePhone.findFirst({
    where: { id: phoneRowId, routeId },
  });
  if (!row) throw new Error("PHONE_NOT_FOUND");

  await prisma.$transaction([
    prisma.patrolRoutePhone.updateMany({
      where: { routeId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.patrolRoutePhone.update({
      where: { id: phoneRowId },
      data: { isPrimary: true },
    }),
  ]);
}

export async function listAvailablePhonesForRoute(routeId: string): Promise<InventoryPhoneRow[]> {
  const assigned = await prisma.patrolRoutePhone.findMany({
    where: { routeId },
    select: { assetId: true },
  });
  const assignedIds = new Set(assigned.map((a) => a.assetId));
  const all = await listAllInventoryPhones();
  return all.filter((p) => !assignedIds.has(p.assetId));
}

export async function resolveDeviceAssetId(device: {
  assetId?: string | null;
  imei?: string | null;
}): Promise<string | null> {
  if (device.assetId) return device.assetId;
  if (!device.imei) return null;

  const phones = await prisma.asset.findMany({
    where: { type: { code: "PHONE" }, status: { not: "RETIRED" } },
    select: { id: true, attributes: true },
  });
  const normalized = device.imei.trim();
  const match = phones.find((p) => assetImeiFromAttributes(p.attributes) === normalized);
  return match?.id ?? null;
}

export async function validateRouteAssignment(input: {
  contractId: string | null;
  locationId: string | null;
  positionId: string | null;
}): Promise<{ contractId: string | null; locationId: string | null; positionId: string | null }> {
  let { contractId, locationId, positionId } = input;

  if (!contractId) {
    return { contractId: null, locationId: null, positionId: null };
  }

  if (positionId && !locationId) {
    const position = await prisma.position.findFirst({
      where: { id: positionId, location: { contractId } },
      select: { id: true, locationId: true },
    });
    if (position) locationId = position.locationId;
    else positionId = null;
  }

  if (locationId) {
    const location = await prisma.contractLocation.findFirst({
      where: { id: locationId, contractId },
    });
    if (!location) locationId = null;
  }

  if (!locationId) positionId = null;

  if (positionId) {
    const position = await prisma.position.findFirst({
      where: { id: positionId, locationId: locationId ?? undefined },
    });
    if (!position) positionId = null;
  }

  return { contractId, locationId, positionId };
}
