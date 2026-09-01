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

const NAF_CONTRACT_LOCATIONS_QUERY = `
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
  AND ub.NO_ZONA_OPERACIONES IS NOT NULL
  AND TRIM(ub.NO_ZONA_OPERACIONES) IS NOT NULL
  AND ub.NO_ZONA_OPERACIONES NOT IN ('00014', '00000')
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

type NafContractLocationRow = {
  noContrato: string;
  noUbicacion: string;
  descripcion: string | null;
  noZona: string | null;
};

function mapOracleRow(row: OracleRow): NafContractLocationRow | null {
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

export type SyncContractLocationsResult = {
  dryRun: boolean;
  zonesSync: { created: number; updated: number; linked: number };
  oracleRows: number;
  contractsMatched: number;
  contractsUnmatched: number;
  locationsCreated: number;
  locationsUpdated: number;
  locationsSkipped: number;
  zonesAssigned: number;
  unmatchedContracts: string[];
  sampleCreates: Array<{ licitacionNo: string; noUbicacion: string; name: string; zone: string | null }>;
};

export async function syncContractLocationsFromNaf(options?: {
  dryRun?: boolean;
}): Promise<SyncContractLocationsResult> {
  const dryRun = options?.dryRun ?? false;

  const zonesSync = dryRun ? { created: 0, updated: 0, linked: 0 } : await syncNafOperacionesZones();

  const oracleRows = await withNafOracleConnection(async (conn) => {
    const result = await conn.execute<OracleRow>(NAF_CONTRACT_LOCATIONS_QUERY);
    return (result.rows ?? []).map(mapOracleRow).filter((r): r is NafContractLocationRow => r != null);
  });

  const [contracts, existingLocations, zoneIdByNafCode] = await Promise.all([
    prisma.contract.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, licitacionNo: true },
    }),
    prisma.contractLocation.findMany({
      where: { nafUbicacionCode: { not: null } },
      select: { id: true, contractId: true, nafUbicacionCode: true, name: true, zoneId: true },
    }),
    dryRun ? buildZoneIdByNafCodeFallback() : loadZoneIdByNafCode(),
  ]);

  const contractByLicitacion = new Map<string, { id: string; licitacionNo: string }>();
  for (const c of contracts) {
    const key = normalizeRrhhContrato(c.licitacionNo);
    if (key) contractByLicitacion.set(key.toUpperCase(), c);
  }

  const existingByKey = new Map<string, (typeof existingLocations)[number]>();
  for (const loc of existingLocations) {
    if (!loc.nafUbicacionCode) continue;
    existingByKey.set(`${loc.contractId}|${loc.nafUbicacionCode}`, loc);
  }

  const unmatchedSet = new Set<string>();
  const matchedContracts = new Set<string>();

  let locationsCreated = 0;
  let locationsUpdated = 0;
  let locationsSkipped = 0;
  let zonesAssigned = 0;
  const sampleCreates: SyncContractLocationsResult["sampleCreates"] = [];
  const creates: Array<{
    contractId: string;
    nafUbicacionCode: string;
    name: string;
    zoneId: string | null;
    sortOrder: number;
  }> = [];
  const updates: Array<{ id: string; name: string; zoneId: string | null }> = [];

  const sortCounters = new Map<string, number>();

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

    const key = `${contract.id}|${row.noUbicacion}`;
    const existing = existingByKey.get(key);

    if (existing) {
      const needsName = existing.name !== name;
      const needsZone = zoneId != null && existing.zoneId !== zoneId;
      if (!needsName && !needsZone) {
        locationsSkipped++;
        continue;
      }
      updates.push({ id: existing.id, name, zoneId: needsZone ? zoneId : existing.zoneId });
      locationsUpdated++;
      if (needsZone && zoneId) zonesAssigned++;
      continue;
    }

    const sortOrder = sortCounters.get(contract.id) ?? 0;
    sortCounters.set(contract.id, sortOrder + 1);

    creates.push({
      contractId: contract.id,
      nafUbicacionCode: row.noUbicacion,
      name,
      zoneId,
      sortOrder,
    });
    locationsCreated++;
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

  if (!dryRun) {
    const batchSize = 100;
    for (let i = 0; i < creates.length; i += batchSize) {
      const batch = creates.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map((data) =>
          prisma.contractLocation.create({
            data: {
              contractId: data.contractId,
              nafUbicacionCode: data.nafUbicacionCode,
              name: data.name,
              zoneId: data.zoneId,
              sortOrder: data.sortOrder,
            },
          }),
        ),
      );
    }

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map((data) =>
          prisma.contractLocation.update({
            where: { id: data.id },
            data: { name: data.name, zoneId: data.zoneId },
          }),
        ),
      );
    }
  }

  return {
    dryRun,
    zonesSync,
    oracleRows: oracleRows.length,
    contractsMatched: matchedContracts.size,
    contractsUnmatched: unmatchedSet.size,
    locationsCreated,
    locationsUpdated,
    locationsSkipped,
    zonesAssigned,
    unmatchedContracts: Array.from(unmatchedSet).sort().slice(0, 30),
    sampleCreates,
  };
}
