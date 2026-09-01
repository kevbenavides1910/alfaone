import { prisma } from "@/modules/core/db/prisma";
import { normalizeRrhhContrato } from "@/modules/empleados/business/contract-match";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import {
  nafOperacionesZoneName,
  normalizeActiveNafOperacionesZoneCode,
} from "@/modules/presupuestos/business/naf-operaciones-zones";
import {
  loadZoneIdByNafCode,
  syncNafOperacionesZones,
} from "@/modules/presupuestos/services/sync-naf-operaciones-zones";
import { normalizeZoneCatalogKey } from "@/modules/disciplinario/business/disciplinary-zone-key";

const ALFA_ZONE_DISPLAY_NAMES: Record<string, string> = {
  "00001": "Gam Este",
  "00002": "Zona Sur",
  "00003": "Atlántico",
  "00005": "Gam Oeste",
  "00007": "Pacifico",
  "00011": "Zona Norte",
  "00012": "ACE",
  "00013": "ADMINISTRATIVA",
  "00014": "Puestos en desuso",
  "00015": "Poder Judicial",
  "00016": "Bandeco",
};

const NAF_SIN_ZONA_KEY = "zona:sin";
const NAF_SIN_ZONA_NAME = "Sin zona operativa";

async function buildZoneIdByNafCodeFallback(): Promise<Map<string, string>> {
  const byCode = await loadZoneIdByNafCode();
  if (byCode.size >= 7) return byCode;
  const zones = await prisma.zone.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  const byName = new Map(zones.map((z) => [normalizeZoneCatalogKey(z.name), z.id]));
  const out = new Map(byCode);
  for (const [code, name] of Object.entries(ALFA_ZONE_DISPLAY_NAMES)) {
    if (out.has(code)) continue;
    const id = byName.get(normalizeZoneCatalogKey(name));
    if (id) out.set(code, id);
  }
  return out;
}

const NAF_CONTRACT_POSITIONS_QUERY = `
SELECT DISTINCT
  TRIM(m.NO_CONTRATO) AS NO_CONTRATO,
  TRIM(m.NO_UBICACION) AS NO_UBICACION,
  MAX(ub.DESCRIPCION) AS DESCRIPCION,
  MAX(ub.NO_ZONA_OPERACIONES) AS NO_ZONA
FROM NAF5.AROPMR m
JOIN NAF5.ARCOUB ub
  ON ub.NO_UBICACION = m.NO_UBICACION
 AND ub.NO_CIA = m.NO_CIA_GRUPO
WHERE m.NO_CONTRATO IS NOT NULL
  AND TRIM(m.NO_CONTRATO) IS NOT NULL
  AND m.NO_UBICACION IS NOT NULL
  AND TRIM(m.NO_UBICACION) IS NOT NULL
  AND m.ESTADO = 'A'
  AND (ub.NO_ZONA_OPERACIONES IS NULL OR ub.NO_ZONA_OPERACIONES NOT IN ('00014', '00000'))
GROUP BY TRIM(m.NO_CONTRATO), TRIM(m.NO_UBICACION)
ORDER BY TRIM(m.NO_CONTRATO), TRIM(m.NO_UBICACION)
`;

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Formato catálogo Operaciones: 05831 - ICT OFICINAS… */
export function formatNafUbicacionLabel(code: string, description: string | null): string {
  const padded = code.replace(/\D/g, "").padStart(5, "0");
  const desc = description?.trim();
  return desc ? `${padded} - ${desc}` : padded;
}

export function normalizeNafUbicacionCode(raw: string | null | undefined): string | null {
  const s = asString(raw);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(5, "0");
}

export function nafSyncGroupKey(noZona: string | null): string {
  return noZona ? `zona:${noZona}` : NAF_SIN_ZONA_KEY;
}

export function nafGroupLocationName(noZona: string | null): string {
  if (!noZona) return NAF_SIN_ZONA_NAME;
  return nafOperacionesZoneName(noZona) ?? ALFA_ZONE_DISPLAY_NAMES[noZona] ?? noZona;
}

type NafContractPositionRow = {
  noContrato: string;
  noUbicacion: string;
  descripcion: string | null;
  noZona: string | null;
};

function mapOracleRow(row: OracleRow): NafContractPositionRow | null {
  const noContrato = normalizeRrhhContrato(asString(row.NO_CONTRATO));
  const noUbicacion = normalizeNafUbicacionCode(asString(row.NO_UBICACION));
  if (!noContrato || !noUbicacion) return null;
  const noZona = normalizeActiveNafOperacionesZoneCode(asString(row.NO_ZONA));
  return {
    noContrato,
    noUbicacion,
    descripcion: asString(row.DESCRIPCION),
    noZona,
  };
}

export type MigrateLegacyNafLocationsResult = {
  legacyLocations: number;
  positionsCreated: number;
  parentLocationsCreated: number;
  legacyDeleted: number;
  skippedWithChildren: number;
};

/** Convierte contract_locations con nafUbicacionCode (import erróneo) → Position bajo ubicación agrupada por zona. */
export async function migrateLegacyNafLocationsToPositions(options?: {
  dryRun?: boolean;
}): Promise<MigrateLegacyNafLocationsResult> {
  const dryRun = options?.dryRun ?? false;

  const legacy = await prisma.contractLocation.findMany({
    where: { nafUbicacionCode: { not: null } },
    include: { positions: { select: { id: true } }, zone: { select: { id: true, nafZonaCode: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const parentCache = new Map<string, string>();
  let positionsCreated = 0;
  let parentLocationsCreated = 0;
  let legacyDeleted = 0;
  let skippedWithChildren = 0;

  const resolveParentId = async (
    contractId: string,
    noZona: string | null,
    zoneId: string | null,
  ): Promise<string> => {
    const groupKey = nafSyncGroupKey(noZona);
    const cacheKey = `${contractId}|${groupKey}`;
    const cached = parentCache.get(cacheKey);
    if (cached) return cached;

    const existing = await prisma.contractLocation.findFirst({
      where: { contractId, nafSyncGroupKey: groupKey },
      select: { id: true },
    });
    if (existing) {
      parentCache.set(cacheKey, existing.id);
      return existing.id;
    }

    if (dryRun) {
      const fakeId = `dry-${cacheKey}`;
      parentCache.set(cacheKey, fakeId);
      parentLocationsCreated++;
      return fakeId;
    }

    const maxSort = await prisma.contractLocation.aggregate({
      where: { contractId },
      _max: { sortOrder: true },
    });

    const created = await prisma.contractLocation.create({
      data: {
        contractId,
        nafSyncGroupKey: groupKey,
        name: nafGroupLocationName(noZona),
        zoneId,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    parentLocationsCreated++;
    parentCache.set(cacheKey, created.id);
    return created.id;
  };

  for (const loc of legacy) {
    if (loc.positions.length > 0) {
      skippedWithChildren++;
      continue;
    }

    const noZona = loc.zone?.nafZonaCode ?? null;
    const parentId = await resolveParentId(loc.contractId, noZona, loc.zoneId);

    if (!dryRun) {
      await prisma.position.create({
        data: {
          locationId: parentId,
          nafUbicacionCode: loc.nafUbicacionCode!,
          name: loc.name,
          description: loc.description,
        },
      });
      await prisma.contractLocation.delete({ where: { id: loc.id } });
    }

    positionsCreated++;
    legacyDeleted++;
  }

  return {
    legacyLocations: legacy.length,
    positionsCreated,
    parentLocationsCreated,
    legacyDeleted,
    skippedWithChildren,
  };
}

export type SyncContractLocationsResult = {
  dryRun: boolean;
  migration: MigrateLegacyNafLocationsResult;
  zonesSync: { created: number; updated: number; linked: number };
  oracleRows: number;
  contractsMatched: number;
  contractsUnmatched: number;
  parentLocationsCreated: number;
  positionsCreated: number;
  positionsUpdated: number;
  positionsSkipped: number;
  /** @deprecated usar positionsCreated */
  locationsCreated: number;
  /** @deprecated usar positionsUpdated */
  locationsUpdated: number;
  /** @deprecated usar positionsSkipped */
  locationsSkipped: number;
  zonesAssigned: number;
  unmatchedContracts: string[];
  sampleCreates: Array<{ licitacionNo: string; noUbicacion: string; name: string; zone: string | null }>;
};

export async function syncContractLocationsFromNaf(options?: {
  dryRun?: boolean;
}): Promise<SyncContractLocationsResult> {
  const dryRun = options?.dryRun ?? false;

  const migration = dryRun
    ? await migrateLegacyNafLocationsToPositions({ dryRun: true })
    : await migrateLegacyNafLocationsToPositions();

  const zonesSync = dryRun ? { created: 0, updated: 0, linked: 0 } : await syncNafOperacionesZones();

  const oracleRows = await withNafOracleConnection(async (conn) => {
    const result = await conn.execute<OracleRow>(NAF_CONTRACT_POSITIONS_QUERY);
    return (result.rows ?? []).map(mapOracleRow).filter((r): r is NafContractPositionRow => r != null);
  });

  const [contracts, existingPositions, zoneIdByNafCode, existingGroupLocations] = await Promise.all([
    prisma.contract.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, licitacionNo: true },
    }),
    prisma.position.findMany({
      where: { nafUbicacionCode: { not: null } },
      select: {
        id: true,
        nafUbicacionCode: true,
        name: true,
        location: { select: { contractId: true } },
      },
    }),
    dryRun ? buildZoneIdByNafCodeFallback() : loadZoneIdByNafCode(),
    prisma.contractLocation.findMany({
      where: { nafSyncGroupKey: { not: null } },
      select: { id: true, contractId: true, nafSyncGroupKey: true, zoneId: true },
    }),
  ]);

  const contractByLicitacion = new Map<string, { id: string; licitacionNo: string }>();
  for (const c of contracts) {
    const key = normalizeRrhhContrato(c.licitacionNo);
    if (key) contractByLicitacion.set(key.toUpperCase(), c);
  }

  const positionByContractNaf = new Map<string, (typeof existingPositions)[number]>();
  for (const pos of existingPositions) {
    if (!pos.nafUbicacionCode) continue;
    positionByContractNaf.set(`${pos.location.contractId}|${pos.nafUbicacionCode}`, pos);
  }

  const groupLocationByKey = new Map<string, (typeof existingGroupLocations)[number]>();
  for (const loc of existingGroupLocations) {
    if (!loc.nafSyncGroupKey) continue;
    groupLocationByKey.set(`${loc.contractId}|${loc.nafSyncGroupKey}`, loc);
  }

  const parentCache = new Map<string, string>();
  for (const [key, loc] of groupLocationByKey) {
    parentCache.set(key, loc.id);
  }

  const unmatchedSet = new Set<string>();
  const matchedContracts = new Set<string>();

  let parentLocationsCreated = 0;
  let positionsCreated = 0;
  let positionsUpdated = 0;
  let positionsSkipped = 0;
  let zonesAssigned = 0;
  const sampleCreates: SyncContractLocationsResult["sampleCreates"] = [];

  const resolveParentLocation = async (
    contractId: string,
    noZona: string | null,
    zoneId: string | null,
  ): Promise<string> => {
    const groupKey = nafSyncGroupKey(noZona);
    const cacheKey = `${contractId}|${groupKey}`;
    const cached = parentCache.get(cacheKey);
    if (cached) return cached;

    const existing = groupLocationByKey.get(cacheKey);
    if (existing) {
      if (!dryRun && zoneId != null && existing.zoneId !== zoneId) {
        await prisma.contractLocation.update({
          where: { id: existing.id },
          data: { zoneId },
        });
        zonesAssigned++;
      }
      parentCache.set(cacheKey, existing.id);
      return existing.id;
    }

    if (dryRun) {
      const fakeId = `dry-${cacheKey}`;
      parentCache.set(cacheKey, fakeId);
      parentLocationsCreated++;
      return fakeId;
    }

    const maxSort = await prisma.contractLocation.aggregate({
      where: { contractId },
      _max: { sortOrder: true },
    });

    const created = await prisma.contractLocation.create({
      data: {
        contractId,
        nafSyncGroupKey: groupKey,
        name: nafGroupLocationName(noZona),
        zoneId,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    parentLocationsCreated++;
    if (zoneId) zonesAssigned++;
    parentCache.set(cacheKey, created.id);
    groupLocationByKey.set(cacheKey, { id: created.id, contractId, nafSyncGroupKey: groupKey, zoneId });
    return created.id;
  };

  for (const row of oracleRows) {
    const contract = contractByLicitacion.get(row.noContrato.toUpperCase());
    if (!contract) {
      unmatchedSet.add(row.noContrato);
      continue;
    }
    matchedContracts.add(contract.id);

    const name = formatNafUbicacionLabel(row.noUbicacion, row.descripcion);
    const zoneId = row.noZona ? zoneIdByNafCode.get(row.noZona) ?? null : null;
    const zonaLabel = row.noZona ? nafOperacionesZoneName(row.noZona) : null;

    const posKey = `${contract.id}|${row.noUbicacion}`;
    const existing = positionByContractNaf.get(posKey);

    if (existing) {
      const needsName = existing.name !== name;
      if (!needsName) {
        positionsSkipped++;
        continue;
      }
      if (!dryRun) {
        await prisma.position.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      positionsUpdated++;
      continue;
    }

    const locationId = await resolveParentLocation(contract.id, row.noZona, zoneId);

    if (!dryRun) {
      await prisma.position.create({
        data: {
          locationId,
          nafUbicacionCode: row.noUbicacion,
          name,
        },
      });
    }
    positionsCreated++;

    if (sampleCreates.length < 8) {
      sampleCreates.push({
        licitacionNo: contract.licitacionNo,
        noUbicacion: row.noUbicacion,
        name,
        zone: zonaLabel,
      });
    }
  }

  return {
    dryRun,
    migration,
    zonesSync,
    oracleRows: oracleRows.length,
    contractsMatched: matchedContracts.size,
    contractsUnmatched: unmatchedSet.size,
    parentLocationsCreated,
    positionsCreated,
    positionsUpdated,
    positionsSkipped,
    locationsCreated: positionsCreated,
    locationsUpdated: positionsUpdated,
    locationsSkipped: positionsSkipped,
    zonesAssigned,
    unmatchedContracts: Array.from(unmatchedSet).sort().slice(0, 30),
    sampleCreates,
  };
}
