/**
 * Catálogo de zonas operativas de Operaciones (.6 / APEX pantalla 89).
 * Fuente autoritativa: NAF5.AROPZO (no VIOPZONAS, que es geográfico).
 */
export const NAF_OPERACIONES_ZONES = [
  { code: "00001", name: "GAM Este" },
  { code: "00002", name: "Zona Sur" },
  { code: "00003", name: "Atlantico" },
  { code: "00005", name: "GAM Oeste" },
  { code: "00007", name: "Pacifico" },
  { code: "00011", name: "Zona Norte" },
  { code: "00012", name: "ACE" },
  { code: "00013", name: "ADMINISTRATIVA" },
  { code: "00014", name: "Puestos en desuso" },
  { code: "00015", name: "PODER JUDICIAL" },
  { code: "00016", name: "Bandeco" },
] as const;

export type NafOperacionesZoneCode = (typeof NAF_OPERACIONES_ZONES)[number]["code"];

const nameByCode = new Map(NAF_OPERACIONES_ZONES.map((z) => [z.code, z.name]));

/** Códigos válidos según NAF5.AROPZO (evita confundir con zonas geográficas en VIOPZONAS). */
export const NAF_OPERACIONES_ZONE_CODES = new Set<string>(
  NAF_OPERACIONES_ZONES.map((z) => z.code),
);

/** Resultado de OPOBTIENE_ZONA_OPERACIONES → código AROPZO. */
export const NAF_OPFN_TO_CODE: Record<string, NafOperacionesZoneCode> = {
  "GAM Este": "00001",
  "GAM Oeste": "00005",
  "Zona Sur": "00002",
  "Zona Norte": "00011",
  Atlantico: "00003",
  Atlántico: "00003",
  Pacifico: "00007",
  Pacífico: "00007",
  ACE: "00012",
  ADMINISTRATIVA: "00013",
  "Puestos en desuso": "00014",
  "PODER JUDICIAL": "00015",
  Bandeco: "00016",
};

export function nafOperacionesZoneName(code: string | null | undefined): string | null {
  if (!code) return null;
  const padded = code.replace(/\D/g, "").padStart(5, "0");
  return nameByCode.get(padded as NafOperacionesZoneCode) ?? null;
}

export function normalizeNafZonaCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return digits.padStart(5, "0");
}

/** Zonas que no deben importarse (inactivas). */
export const NAF_INACTIVE_ZONE_CODES = new Set(["00000", "00014"]);

/** Valida código AROPZO activo desde ARCOUB.NO_ZONA_OPERACIONES. */
export function normalizeActiveNafOperacionesZoneCode(
  raw: string | null | undefined,
): string | null {
  const code = normalizeNafZonaCode(raw);
  if (!code || NAF_INACTIVE_ZONE_CODES.has(code) || !NAF_OPERACIONES_ZONE_CODES.has(code)) {
    return null;
  }
  return code;
}

/** Resuelve zona operativa: OPOBTIENE primero; VIOPUBICACION_ZONA solo si el código está en AROPZO. */
export function resolveNafOperacionesZoneCode(
  viopZona: string | null | undefined,
  opfnZona: string | null | undefined,
): string | null {
  const fn = opfnZona?.trim();
  if (fn && fn in NAF_OPFN_TO_CODE) {
    const code = NAF_OPFN_TO_CODE[fn]!;
    if (!NAF_INACTIVE_ZONE_CODES.has(code)) return code;
  }

  const vz = normalizeNafZonaCode(viopZona);
  if (vz && NAF_OPERACIONES_ZONE_CODES.has(vz) && !NAF_INACTIVE_ZONE_CODES.has(vz)) {
    return vz;
  }

  return null;
}
