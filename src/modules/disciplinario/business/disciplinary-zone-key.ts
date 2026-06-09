/** Variantes corruptas (UTF-8 mal leído) → clave canónica del catálogo. */
const ZONE_KEY_ALIASES: Record<string, string> = {
  /** Pac\uFFFDfico / Pacfico: se pierde la «i» al quitar el carácter de reemplazo. */
  pacfico: "pacifico",
};

/** Limpia texto de zona tras imports con codificación incorrecta (ej. Pacfico). */
export function sanitizeZoneImportText(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw)
    .trim()
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
  return s || null;
}

/** Clave para emparejar el texto «zona» de imports con el nombre en catálogo (sin depender de Prisma). */
export function normalizeZoneCatalogKey(raw: string | null | undefined): string {
  const cleaned = sanitizeZoneImportText(raw);
  if (!cleaned) return "";
  const key = cleaned
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return ZONE_KEY_ALIASES[key] ?? key;
}
