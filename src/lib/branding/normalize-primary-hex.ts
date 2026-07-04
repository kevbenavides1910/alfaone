import { DEFAULT_PRIMARY_HEX } from "@/modules/plataforma/branding-constants";

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16) / 255,
    g: parseInt(m[1].slice(2, 4), 16) / 255,
    b: parseInt(m[1].slice(4, 6), 16) / 255,
  };
}

/** Luminancia relativa WCAG (0 = negro, 1 = blanco). */
function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const r = linear(rgb.r);
  const g = linear(rgb.g);
  const b = linear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Evita primarios demasiado claros (p. ej. blanco) que rompen pestañas y botones con texto blanco.
 */
export function normalizePrimaryHex(hex: string | null | undefined): string {
  const trimmed = hex?.trim();
  if (!trimmed) return DEFAULT_PRIMARY_HEX;

  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const lum = relativeLuminance(normalized);
  if (lum === null || lum > 0.72) return DEFAULT_PRIMARY_HEX;

  return normalized;
}

export function isPrimaryHexUsable(hex: string): boolean {
  const trimmed = hex?.trim();
  if (!trimmed) return false;
  const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const lum = relativeLuminance(normalized);
  return lum !== null && lum <= 0.72;
}
