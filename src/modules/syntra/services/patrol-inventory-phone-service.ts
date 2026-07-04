import { prisma } from "@/modules/core/db/prisma";
import { patrolImeisMatch } from "@/modules/syntra/utils/costa-rica-time";

export type InventoryPhone = Awaited<ReturnType<typeof findPhoneAssetByImei>>;

export function assetImeiFromAttributes(attributes: unknown): string {
  if (!attributes || typeof attributes !== "object") return "";
  const imei = (attributes as Record<string, unknown>).imei;
  return imei == null ? "" : String(imei).trim();
}

function assetImei(attributes: unknown): string {
  return assetImeiFromAttributes(attributes);
}

export type InventoryPhoneRow = {
  assetId: string;
  imei: string;
  phoneLabel: string;
  positionId: string | null;
  positionName: string | null;
  locationName: string | null;
  contractId: string | null;
  contractName: string | null;
};

/** @deprecated use InventoryPhoneRow */
export type ContractPhoneRow = InventoryPhoneRow;

export async function findPhoneAssetByImei(imei: string) {
  const normalized = imei.trim();
  if (!normalized) return null;

  const phones = await prisma.asset.findMany({
    where: {
      type: { code: "PHONE" },
      status: { not: "RETIRED" },
    },
    include: {
      type: true,
      currentPosition: {
        include: {
          location: { include: { contract: true } },
        },
      },
    },
  });

  return phones.find((asset) => patrolImeisMatch(assetImei(asset.attributes), normalized)) ?? null;
}

export async function findPhoneAssetAtPosition(positionId: string) {
  const phones = await prisma.asset.findMany({
    where: {
      type: { code: "PHONE" },
      status: { not: "RETIRED" },
      currentPositionId: positionId,
    },
    include: {
      type: true,
      currentPosition: {
        include: {
          location: { include: { contract: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  return phones[0] ?? null;
}

export async function listPositionsWithInventoryPhones() {
  const phones = await prisma.asset.findMany({
    where: {
      type: { code: "PHONE" },
      status: { not: "RETIRED" },
      currentPositionId: { not: null },
    },
    include: {
      currentPosition: {
        include: {
          location: { include: { contract: true } },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const byPosition = new Map<
    string,
    {
      positionId: string;
      positionName: string;
      contractName: string | null;
      imei: string;
      phoneLabel: string;
    }
  >();

  for (const phone of phones) {
    if (!phone.currentPositionId || !phone.currentPosition) continue;
    if (byPosition.has(phone.currentPositionId)) continue;
    byPosition.set(phone.currentPositionId, {
      positionId: phone.currentPositionId,
      positionName: phone.currentPosition.name,
      contractName: phone.currentPosition.location?.contract?.client ?? null,
      imei: assetImei(phone.attributes),
      phoneLabel: phone.name?.trim() || phone.code,
    });
  }

  return [...byPosition.values()].sort((a, b) =>
    a.positionName.localeCompare(b.positionName, "es"),
  );
}

export async function listPhonesForContract(contractId: string): Promise<InventoryPhoneRow[]> {
  const phones = await prisma.asset.findMany({
    where: {
      type: { code: "PHONE" },
      status: { not: "RETIRED" },
      currentPosition: { location: { contractId } },
    },
    include: {
      currentPosition: {
        include: {
          location: { include: { contract: true } },
        },
      },
    },
    orderBy: [{ currentPosition: { name: "asc" } }, { code: "asc" }],
  });

  return phones.map((phone) => mapPhoneAsset(phone));
}

export async function listAllInventoryPhones(): Promise<InventoryPhoneRow[]> {
  const phones = await prisma.asset.findMany({
    where: {
      type: { code: "PHONE" },
      status: { not: "RETIRED" },
    },
    include: {
      currentPosition: {
        include: {
          location: { include: { contract: true } },
        },
      },
    },
    orderBy: [{ code: "asc" }],
  });

  return phones.map((phone) => mapPhoneAsset(phone));
}

function mapPhoneAsset(phone: {
  id: string;
  code: string;
  name: string | null;
  attributes: unknown;
  currentPositionId: string | null;
  currentPosition: {
    name: string;
    location: { name: string; contractId: string; contract: { client: string } | null } | null;
  } | null;
}): InventoryPhoneRow {
  return {
    assetId: phone.id,
    imei: assetImei(phone.attributes),
    phoneLabel: phone.name?.trim() || phone.code,
    positionId: phone.currentPositionId,
    positionName: phone.currentPosition?.name ?? null,
    locationName: phone.currentPosition?.location?.name ?? null,
    contractId: phone.currentPosition?.location?.contractId ?? null,
    contractName: phone.currentPosition?.location?.contract?.client ?? null,
  };
}

export async function resolveDevicePositionLabel(device: {
  positionId?: string | null;
  imei?: string | null;
  label?: string | null;
}) {
  if (device.positionId) {
    const position = await prisma.position.findUnique({
      where: { id: device.positionId },
      select: { name: true },
    });
    if (position?.name) return position.name;
  }

  if (device.imei) {
    const phone = await findPhoneAssetByImei(device.imei);
    if (phone?.currentPosition?.name) return phone.currentPosition.name;
  }

  return device.label ?? "";
}
