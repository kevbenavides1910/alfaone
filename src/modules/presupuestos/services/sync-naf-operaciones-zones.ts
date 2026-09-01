import { prisma } from "@/modules/core/db/prisma";
import { normalizeZoneCatalogKey } from "@/modules/disciplinario/business/disciplinary-zone-key";
import {
  NAF_OPERACIONES_ZONES,
  normalizeNafZonaCode,
} from "@/modules/presupuestos/business/naf-operaciones-zones";

/** Nombres canónicos en Alfa One (pueden diferir en capitalización del catálogo NAF). */
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

export type SyncNafZonesResult = {
  created: number;
  updated: number;
  linked: number;
};

/**
 * Asegura que las 11 zonas operativas de Operaciones (.6) existan en Alfa One
 * con su código NAF (00001–00016) y nombre canónico.
 */
export async function syncNafOperacionesZones(): Promise<SyncNafZonesResult> {
  const existing = await prisma.zone.findMany({
    select: { id: true, name: true, nafZonaCode: true },
  });

  const byCode = new Map(existing.filter((z) => z.nafZonaCode).map((z) => [z.nafZonaCode!, z]));
  const byNameKey = new Map(existing.map((z) => [normalizeZoneCatalogKey(z.name), z]));

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (let i = 0; i < NAF_OPERACIONES_ZONES.length; i++) {
    const { code } = NAF_OPERACIONES_ZONES[i];
    const nafCode = normalizeNafZonaCode(code)!;
    const displayName = ALFA_ZONE_DISPLAY_NAMES[nafCode] ?? NAF_OPERACIONES_ZONES[i].name;

    const byNaf = byCode.get(nafCode);
    if (byNaf) {
      if (byNaf.name !== displayName || byNaf.nafZonaCode !== nafCode) {
        await prisma.zone.update({
          where: { id: byNaf.id },
          data: { name: displayName, nafZonaCode: nafCode, sortOrder: i + 1, isActive: true },
        });
        updated++;
      }
      continue;
    }

    const nameKey = normalizeZoneCatalogKey(displayName);
    const byName = nameKey ? byNameKey.get(nameKey) : undefined;
    if (byName) {
      await prisma.zone.update({
        where: { id: byName.id },
        data: { nafZonaCode: nafCode, sortOrder: i + 1, isActive: true },
      });
      linked++;
      byCode.set(nafCode, { ...byName, nafZonaCode: nafCode });
      continue;
    }

    await prisma.zone.create({
      data: {
        name: displayName,
        nafZonaCode: nafCode,
        sortOrder: i + 1,
        isActive: nafCode !== "00014",
        description: `Zona operativa NAF ${nafCode}`,
      },
    });
    created++;
  }

  return { created, updated, linked };
}

export async function loadZoneIdByNafCode(): Promise<Map<string, string>> {
  const zones = await prisma.zone.findMany({
    where: { nafZonaCode: { not: null }, isActive: true },
    select: { id: true, nafZonaCode: true },
  });
  return new Map(
    zones
      .filter((z): z is { id: string; nafZonaCode: string } => z.nafZonaCode != null)
      .map((z) => [z.nafZonaCode, z.id]),
  );
}
