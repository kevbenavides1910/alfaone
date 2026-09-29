/**
 * Moneda de OC Codisa (ARIMENCORDEN.MONEDA) y conversión a CRC para gastos/pagos.
 * Codisa: P/CRC = colones, D/USD = dólares. Alfa One guarda amount siempre en CRC.
 */

export type OcCurrencyCode = "CRC" | "USD" | "EUR";

/** Normaliza códigos Codisa / ISO a CRC | USD | EUR. */
export function normalizeOcCurrency(raw: string | null | undefined): OcCurrencyCode | null {
  const m = (raw ?? "").trim().toUpperCase();
  if (!m) return null;
  if (m === "P" || m === "CRC" || m === "¢" || m === "COLON" || m === "COLONES") return "CRC";
  if (m === "D" || m === "USD" || m === "$" || m === "DOLAR" || m === "DOLARES" || m === "DÓLAR" || m === "DÓLARES") {
    return "USD";
  }
  if (m === "E" || m === "EUR" || m === "EURO" || m === "EUROS") return "EUR";
  return null;
}

export function isForeignOcCurrency(code: OcCurrencyCode | null | undefined): boolean {
  return code === "USD" || code === "EUR";
}

export function ocCurrencySymbol(code: OcCurrencyCode | null | undefined): string {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return "₡";
}

export function formatOcMoney(
  monto: number | null | undefined,
  monedaRaw: string | null | undefined,
): string {
  if (monto == null || !Number.isFinite(monto)) return "—";
  const code = normalizeOcCurrency(monedaRaw) ?? "CRC";
  const formatted = monto.toLocaleString("es-CR", { maximumFractionDigits: 2 });
  return `${ocCurrencySymbol(code)}${formatted}`;
}

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** CRC = montoOriginal × tipoCambio. */
export function convertOcAmountToCrc(montoOriginal: number, tipoCambio: number): number {
  if (!Number.isFinite(montoOriginal) || !Number.isFinite(tipoCambio) || tipoCambio <= 0) {
    throw new Error("Monto original y tipo de cambio deben ser válidos");
  }
  return roundMoney2(montoOriginal * tipoCambio);
}

export type OcFxFields = {
  monedaOrigen: OcCurrencyCode | null;
  montoOriginal: number | null;
  tipoCambio: number | null;
  /** Monto en CRC (amount del gasto). */
  amountCrc: number;
};

/**
 * A partir de una OC y un tipo de cambio (obligatorio si no es CRC),
 * calcula los campos a persistir. Si es CRC, TC=1 y amount = monto OC.
 */
export function resolveExpenseAmountFromOc(opts: {
  montoOc: number | null | undefined;
  monedaOc: string | null | undefined;
  tipoCambio?: number | null;
}): OcFxFields | { error: string } {
  const monto = opts.montoOc;
  if (monto == null || !Number.isFinite(monto) || monto <= 0) {
    return { error: "La OC no tiene monto válido" };
  }
  const code = normalizeOcCurrency(opts.monedaOc) ?? "CRC";
  if (!isForeignOcCurrency(code)) {
    return {
      monedaOrigen: "CRC",
      montoOriginal: roundMoney2(monto),
      tipoCambio: 1,
      amountCrc: roundMoney2(monto),
    };
  }
  const tc = opts.tipoCambio;
  if (tc == null || !Number.isFinite(tc) || tc <= 0) {
    return { error: `Indique el tipo de cambio ${code}→CRC` };
  }
  return {
    monedaOrigen: code,
    montoOriginal: roundMoney2(monto),
    tipoCambio: tc,
    amountCrc: convertOcAmountToCrc(monto, tc),
  };
}
