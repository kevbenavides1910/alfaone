import { prisma } from "@/modules/core/db/prisma";
import {
  normalizeZoneCatalogKey,
  sanitizeZoneImportText,
} from "@/modules/disciplinario/business/disciplinary-zone-key";

export {
  normalizeZoneCatalogKey,
  sanitizeZoneImportText,
} from "@/modules/disciplinario/business/disciplinary-zone-key";

export type ZoneDisciplinaryDefaults = {
  administrator: string | null;
  administratorEmail: string | null;
};

/** Mapa clave normalizada → nombre canónico en catálogo (solo zonas activas). */
export async function loadZoneCatalogNameByKey(): Promise<Map<string, string>> {
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    select: { name: true },
  });
  const m = new Map<string, string>();
  for (const z of zones) {
    const k = normalizeZoneCatalogKey(z.name);
    if (!k || m.has(k)) continue;
    m.set(k, z.name);
  }
  return m;
}

/** Devuelve el nombre del catálogo si la zona importada coincide; si no, el texto saneado. */
export function canonicalZoneLabel(
  nameByKey: Map<string, string>,
  raw: string | null | undefined,
): string | null {
  const cleaned = sanitizeZoneImportText(raw);
  if (!cleaned) return null;
  const k = normalizeZoneCatalogKey(cleaned);
  return nameByKey.get(k) ?? cleaned;
}

/** Mapa nombre-de-zona-normalizado → datos disciplinarios (solo zonas activas). */
export async function loadZoneDisciplinaryDefaultsMap(): Promise<
  Map<string, ZoneDisciplinaryDefaults>
> {
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    select: {
      name: true,
      disciplinaryAdministrator: true,
      disciplinaryAdministratorEmail: true,
    },
  });
  const m = new Map<string, ZoneDisciplinaryDefaults>();
  for (const z of zones) {
    const k = normalizeZoneCatalogKey(z.name);
    if (!k) continue;
    m.set(k, {
      administrator: z.disciplinaryAdministrator?.trim() || null,
      administratorEmail: z.disciplinaryAdministratorEmail?.trim() || null,
    });
  }
  return m;
}

export function defaultsForZoneText(
  map: Map<string, ZoneDisciplinaryDefaults>,
  zonaText: string | null | undefined,
): ZoneDisciplinaryDefaults | null {
  const k = normalizeZoneCatalogKey(zonaText ?? "");
  if (!k) return null;
  return map.get(k) ?? null;
}

/** Combina fila import + zona del maestro empleado (admin y correo pueden venir de distintas claves). */
export function mergeZoneDisciplinaryDefaults(
  a: ZoneDisciplinaryDefaults | null,
  b: ZoneDisciplinaryDefaults | null,
): ZoneDisciplinaryDefaults | null {
  if (!a) return b;
  if (!b) return a;
  return {
    administrator: a.administrator ?? b.administrator,
    administratorEmail: a.administratorEmail ?? b.administratorEmail,
  };
}

/** Une coincidencias de catálogo para varios textos de zona (maestro, Excel, valor editado). */
export function mergeDefaultsForZoneTexts(
  map: Map<string, ZoneDisciplinaryDefaults>,
  ...zonaTexts: (string | null | undefined)[]
): ZoneDisciplinaryDefaults | null {
  let out: ZoneDisciplinaryDefaults | null = null;
  const seen = new Set<string>();
  for (const t of zonaTexts) {
    const k = normalizeZoneCatalogKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out = mergeZoneDisciplinaryDefaults(out, defaultsForZoneText(map, t));
  }
  return out;
}
