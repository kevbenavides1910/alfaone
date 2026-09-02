/**
 * Odoo guarda `timestamp without time zone` como hora de pared (CR).
 * Prisma/node lo lee como UTC; si enviamos `.toISOString()` el navegador resta −6h.
 * Devolvemos ISO naive (sin Z) para que `new Date(...)` use componentes locales.
 */
export function odooWallTimeToClient(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
