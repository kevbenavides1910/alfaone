import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  CALENDARIO_EXCLUDED_NAF_ZONES,
  type CalendarioContractOption,
  type CalendarioZoneRef,
} from "@/modules/naf-operaciones/business/calendario-types";

const operativeZoneWhere: Prisma.ZoneWhereInput = {
  OR: [{ nafZonaCode: null }, { nafZonaCode: { notIn: CALENDARIO_EXCLUDED_NAF_ZONES } }],
};

/** Zonas operativas activas (excluye desuso / finalizado). */
export async function listCalendarioZones(): Promise<CalendarioZoneRef[]> {
  return prisma.zone.findMany({
    where: { isActive: true, ...operativeZoneWhere },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export const contractZonesSelect = {
  id: true,
  licitacionNo: true,
  client: true,
  company: true,
  positions: {
    where: { zoneId: { not: null }, zone: operativeZoneWhere },
    distinct: ["zoneId"],
    select: { zone: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ContractSelect;

type ContractWithZones = Prisma.ContractGetPayload<{ select: typeof contractZonesSelect }>;

export function mapContractOption(c: ContractWithZones): CalendarioContractOption {
  const zones = c.positions
    .map((p) => p.zone)
    .filter((z): z is CalendarioZoneRef => z != null)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return {
    id: c.id,
    licitacionNo: c.licitacionNo,
    client: c.client,
    company: c.company,
    zones,
  };
}

/** Contratos vigentes; con `zoneId`, solo los que tienen puestos en esa zona operativa. */
export function calendarioContractsWhere(zoneId?: string | null): Prisma.ContractWhereInput {
  return {
    deletedAt: null,
    status: "ACTIVE",
    ...(zoneId ? { positions: { some: { zoneId } } } : {}),
  };
}

export async function listCalendarioContracts(filters: {
  zoneId?: string | null;
}): Promise<CalendarioContractOption[]> {
  const rows = await prisma.contract.findMany({
    where: calendarioContractsWhere(filters.zoneId),
    orderBy: [{ client: "asc" }, { licitacionNo: "asc" }],
    select: contractZonesSelect,
  });
  return rows.map(mapContractOption);
}
