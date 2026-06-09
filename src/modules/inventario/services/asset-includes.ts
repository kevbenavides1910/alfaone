import type { Prisma } from "@prisma/client";

export const assetListInclude = {
  type: true,
  currentPosition: {
    include: {
      location: {
        include: {
          contract: { select: { id: true, licitacionNo: true, client: true } },
          zone: { select: { id: true, name: true } },
        },
      },
    },
  },
  acquisitionExpense: { select: { id: true, description: true, referenceNumber: true } },
} satisfies Prisma.AssetInclude;

export const assetDetailInclude = {
  type: true,
  currentPosition: {
    include: {
      location: { include: { contract: { select: { id: true, licitacionNo: true, client: true } } } },
    },
  },
  acquisitionExpense: { select: { id: true, description: true, referenceNumber: true } },
  movements: {
    orderBy: { createdAt: "desc" as const },
    include: {
      fromPosition: { include: { location: { include: { contract: { select: { licitacionNo: true } } } } } },
      toPosition: { include: { location: { include: { contract: { select: { licitacionNo: true } } } } } },
      expense: { select: { id: true, description: true, referenceNumber: true } },
    },
  },
} satisfies Prisma.AssetInclude;

export const assetMovementListInclude = {
  fromPosition: { include: { location: { include: { contract: { select: { licitacionNo: true } } } } } },
  toPosition: { include: { location: { include: { contract: { select: { licitacionNo: true } } } } } },
  expense: { select: { id: true, description: true, referenceNumber: true } },
} satisfies Prisma.AssetMovementInclude;

export const assetMovementFeedInclude = {
  asset: { include: { type: true } },
  fromPosition: {
    include: {
      location: {
        include: {
          contract: { select: { licitacionNo: true } },
          zone: { select: { id: true, name: true } },
        },
      },
    },
  },
  toPosition: {
    include: {
      location: {
        include: {
          contract: { select: { licitacionNo: true } },
          zone: { select: { id: true, name: true } },
        },
      },
    },
  },
  expense: { select: { id: true, description: true, referenceNumber: true } },
} satisfies Prisma.AssetMovementInclude;
