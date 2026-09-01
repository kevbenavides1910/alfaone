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
  return {
    noContrato,
    noUbicacion,
    descripcion: asString(row.DESCRIPCION),
    noZona: normalizeActiveNafOperacionesZoneCode(asString(row.NO_ZONA)),
  };
}

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

export type MigrateLegacyNafLocationsResult = {
  legacyLocations: number;
  positionsCreated: number;
  legacyDeleted: number;
  skippedWithChildren: number;
};

/** Convierte ubicaciones importadas por error (nafUbicacionCode) a puestos sueltos con zona. */
export async function migrateLegacyNafLocationsToPositions(options?: {
  dryRun?: boolean;
}): Promise<MigrateLegacyNafLocationsResult> {
  const dryRun = options?.dryRun ?? false;

  const legacy = await prisma.contractLocation.findMany({
    where: { nafUbicacionCode: { not: null } },
    include: { positions: { select: { id: true } }, zone: { select: { id: true, nafZonaCode: true } } },
  });

  let positionsCreated = 0;
  let legacyDeleted = 0;
  let skippedWithChildren = 0;

  for (const loc of legacy) {
    if (loc.positions.length > 0) {
      skippedWithChildren++;
      continue;
    }

    if (!dryRun) {
      await prisma.position.create({
        data: {
          contractId: loc.contractId,
          nafUbicacionCode: loc.nafUbicacionCode!,
          name: loc.name,
          description: loc.description,
          zoneId: loc.zoneId,
          locationId: null,
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
    legacyDeleted,
    skippedWithChildren,
  };
}

/** Elimina ubicaciones auto-generadas por zona (nafSyncGroupKey) y deja puestos sin ubicación. */
export async function dissolveNafZoneGroupLocations(options?: { dryRun?: boolean }): Promise<number> {
  const dryRun = options?.dryRun ?? false;
  const groups = await prisma.contractLocation.findMany({
    where: { nafSyncGroupKey: { not: null } },
    include: { positions: { select: { id: true, zoneId: true } } },
  });

  let dissolved = 0;
  for (const loc of groups) {
    if (!dryRun) {
      for (const pos of loc.positions) {
        await prisma.position.update({
          where: { id: pos.id },
          data: {
            locationId: null,
            zoneId: pos.zoneId ?? loc.zoneId,
          },
        });
      }
      await prisma.contractLocation.delete({ where: { id: loc.id } });
    }
    dissolved++;
  }
  return dissolved;
}

export type SyncContractLocationsResult = {
  dryRun: boolean;
  migration: MigrateLegacyNafLocationsResult;
  zoneGroupsDissolved: number;
  zonesSync: { created: number; updated: number; linked: number };
  oracleRows: number;
  contractsMatched: number;
  contractsUnmatched: number;
  positionsCreated: number;
  positionsUpdated: number;
  positionsSkipped: number;
  /** @deprecated usar positionsCreated */
  locationsCreated: number;
  /** @deprecated usar positionsUpdated */
  locationsUpdated: number;
  /** @deprecated usar positionsSkipped */
  locationsSkipped: number;
  parentLocationsCreated: number;
  zonesAssigned: number;
  unmatchedContracts: string[];
  sampleCreates: Array<{ licitacionNo: string; noUbicacion: string; name: string; zone: string | null }>;
};

export async function syncContractLocationsFromNaf(options?: {
  dryRun?: boolean;
}): Promise<SyncContractLocationsResult> {
  const dryRun = options?.dryRun ?? false;

  const migration = await migrateLegacyNafLocationsToPositions({ dryRun });
  const zoneGroupsDissolved = await dissolveNafZoneGroupLocations({ dryRun });

  const zonesSync = dryRun ? { created: 0, updated: 0, linked: 0 } : await syncNafOperacionesZones();

  const oracleRows = await withNafOracleConnection(async (conn) => {
    const result = await conn.execute<OracleRow>(NAF_CONTRACT_POSITIONS_QUERY);
    return (result.rows ?? []).map(mapOracleRow).filter((r): r is NafContractPositionRow => r != null);
  });

  const [contracts, existingPositions, zoneIdByNafCode] = await Promise.all([
    prisma.contract.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, licitacionNo: true },
    }),
    prisma.position.findMany({
      where: { nafUbicacionCode: { not: null } },
      select: {
        id: true,
        contractId: true,
        nafUbicacionCode: true,
        name: true,
        zoneId: true,
        locationId: true,
      },
    }),
    dryRun ? buildZoneIdByNafCodeFallback() : loadZoneIdByNafCode(),
  ]);

  const contractByLicitacion = new Map<string, { id: string; licitacionNo: string }>();
  for (const c of contracts) {
    const key = normalizeRrhhContrato(c.licitacionNo);
    if (key) contractByLicitacion.set(key.toUpperCase(), c);
  }

  const positionByKey = new Map<string, (typeof existingPositions)[number]>();
  for (const pos of existingPositions) {
    if (!pos.nafUbicacionCode) continue;
    positionByKey.set(`${pos.contractId}|${pos.nafUbicacionCode}`, pos);
  }

  const unmatchedSet = new Set<string>();
  const matchedContracts = new Set<string>();

  let positionsCreated = 0;
  let positionsUpdated = 0;
  let positionsSkipped = 0;
  let zonesAssigned = 0;
  const sampleCreates: SyncContractLocationsResult["sampleCreates"] = [];

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
    const existing = positionByKey.get(posKey);

    if (existing) {
      const needsName = existing.name !== name;
      const needsZone = zoneId != null && existing.zoneId !== zoneId;
      if (!needsName && !needsZone) {
        positionsSkipped++;
        continue;
      }
      if (!dryRun) {
        await prisma.position.update({
          where: { id: existing.id },
          data: {
            name,
            ...(needsZone ? { zoneId } : {}),
          },
        });
      }
      positionsUpdated++;
      if (needsZone && zoneId) zonesAssigned++;
      continue;
    }

    if (!dryRun) {
      await prisma.position.create({
        data: {
          contractId: contract.id,
          nafUbicacionCode: row.noUbicacion,
          name,
          zoneId,
          locationId: null,
        },
      });
    }
    positionsCreated++;
    if (zoneId) zonesAssigned++;

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
    zoneGroupsDissolved,
    zonesSync,
    oracleRows: oracleRows.length,
    contractsMatched: matchedContracts.size,
    contractsUnmatched: unmatchedSet.size,
    positionsCreated,
    positionsUpdated,
    positionsSkipped,
    locationsCreated: positionsCreated,
    locationsUpdated: positionsUpdated,
    locationsSkipped: positionsSkipped,
    parentLocationsCreated: 0,
    zonesAssigned,
    unmatchedContracts: Array.from(unmatchedSet).sort().slice(0, 30),
    sampleCreates,
  };
}
