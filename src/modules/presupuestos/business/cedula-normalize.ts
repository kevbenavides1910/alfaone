/** Dígitos normalizados de cédula costarricense (9 dígitos, sin guiones ni tipo). */
export function normalizeCedulaDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim().toUpperCase();
  if (/E\+/.test(s)) return "";
  s = s.replace(/^CF\s*CR\s*/i, "").replace(/^CR\s*(NI|CF)\s*/i, "");
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length > 9) return digits.slice(-9);
  if (digits.length < 9) return digits.padStart(9, "0");
  return digits;
}

export function cedulasMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = normalizeCedulaDigits(a);
  const db = normalizeCedulaDigits(b);
  return da.length >= 9 && da === db;
}

/** Extrae cédulas tipo CCSS (0-123456789) del texto. */
export function extractCcssCedulas(text: string): string[] {
  return [...text.matchAll(/\b[0-9]-\d{7,11}\b/g)].map((m) => m[0]);
}

/** Extrae cédulas de 9 dígitos (INS y similares). */
export function extractInsCedulas(text: string): string[] {
  return [...text.matchAll(/\b\d{9}\b/g)].map((m) => m[0]);
}
