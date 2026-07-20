/** Convención NAF: 1900-01-01 = vigencia indefinida. */
export function isVigenciaIndefinida(desde?: string | null, hasta?: string | null): boolean {
  const d = (desde ?? "").slice(0, 10);
  const h = (hasta ?? "").slice(0, 10);
  return d === "1900-01-01" && (h === "1900-01-01" || h === "2090-01-01" || !h);
}

export function formatExpedienteVigencia(
  desde?: string | null,
  hasta?: string | null,
): string {
  if (isVigenciaIndefinida(desde, hasta)) return "Indefinida";
  const d = (desde ?? "").slice(0, 10);
  const h = (hasta ?? "").slice(0, 10);
  if (d && h) return `${d} → ${h}`;
  return d || h || "—";
}
