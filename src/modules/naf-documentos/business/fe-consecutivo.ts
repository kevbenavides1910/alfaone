/** Normaliza consecutivo FE de Hacienda a 20 dígitos. */
export function normalizeFeConsecutivo(raw: string | null | undefined): string | null {
  const t = raw?.trim().replace(/\s/g, "");
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  if (t.length === 20) return t;
  if (t.length >= 10 && t.length < 20) return t.padStart(20, "0");
  return null;
}
