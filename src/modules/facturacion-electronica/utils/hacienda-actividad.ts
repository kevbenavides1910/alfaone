import actividadesCatalog from "../data/actividades-ciiu4-cr.json";

type ActividadCatalogRow = { codigo: string; descripcion: string };

const catalogByNormalized = new Map<string, string>();
for (const row of actividadesCatalog as ActividadCatalogRow[]) {
  const norm = normalizeTribuActividadInternal(row.codigo);
  if (norm) catalogByNormalized.set(norm, row.codigo);
}

function normalizeTribuActividadInternal(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (/^\d{6}$/.test(s)) return s;

  const dot = /^(\d+)\.(\d+)$/.exec(s);
  if (dot) {
    const left = parseInt(dot[1]!, 10);
    const rightPart = dot[2]!;
    const right = rightPart.length <= 2 ? parseInt(rightPart, 10) : parseInt(rightPart.slice(0, 2), 10);
    return `${left.toString().padStart(4, "0")}${right.toString().padStart(2, "0")}`.slice(-6).padStart(6, "0");
  }

  if (/^\d{1,4}$/.test(s)) {
    return `${parseInt(s, 10).toString().padStart(4, "0")}00`;
  }

  const digits = s.replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);
  if (digits.length > 0) return digits.padStart(6, "0");
  return "";
}

/**
 * Normaliza código actividad TRIBU (ej. 7020.0) a 6 dígitos internos (702000).
 */
export function normalizeTribuActividad(raw: string | null | undefined): string {
  return normalizeTribuActividadInternal(raw);
}

function sixDigitsToTribuFallback(six: string): string {
  const m = /^(\d{4})(\d{2})$/.exec(six);
  if (!m) return six;
  return `${parseInt(m[1]!, 10)}.${parseInt(m[2]!, 10)}`;
}

/**
 * Convierte cualquier entrada válida al formato TRIBU del catálogo Hacienda (ej. 8010.0).
 */
export function toTribuCodigo(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (/^\d+\.\d+$/.test(s)) return s;

  const norm = normalizeTribuActividadInternal(s);
  if (!norm) return "";
  return catalogByNormalized.get(norm) ?? sixDigitsToTribuFallback(norm);
}

export function isActividadEnCatalogo(raw: string | null | undefined): boolean {
  const tribu = toTribuCodigo(raw);
  if (!tribu) return false;
  return (actividadesCatalog as ActividadCatalogRow[]).some((a) => a.codigo === tribu);
}

/**
 * Código actividad para XML v4.4 — siempre formato TRIBU (ej. 8010.0), no 6 dígitos.
 */
export function actividadForXml(raw: string | null | undefined): string {
  const tribu = toTribuCodigo(raw);
  return tribu || "000000";
}
