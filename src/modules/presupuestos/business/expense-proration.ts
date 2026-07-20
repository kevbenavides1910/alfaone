/**
 * Lógica pura de prorrateo de gastos en meses.
 */

/**
 * Reparte un monto total en N partes mensuales garantizando que la suma exacta
 * sea igual al total (ajuste de centavos en las primeras partes).
 *
 * Ejemplo: splitAmountAcrossMonths(100.00, 3) -> [33.34, 33.33, 33.33]
 */
export function splitAmountAcrossMonths(total: number, months: number): number[] {
  if (months <= 1) return [total];
  if (!Number.isFinite(total) || total < 0) {
    throw new Error("El monto total debe ser un número finito positivo");
  }
  if (!Number.isInteger(months) || months < 1) {
    throw new Error("La cantidad de meses debe ser un entero positivo");
  }

  const cents = Math.round(total * 100);
  const base = Math.floor(cents / months);
  const remainder = cents - base * months;
  const out: number[] = [];

  for (let i = 0; i < months; i++) {
    // distribuimos el remanente de centavos en las primeras partes
    out.push((base + (i < remainder ? 1 : 0)) / 100);
  }

  return out;
}

/**
 * Genera los periodos mensuales a partir de un periodo inicial (YYYY-MM).
 */
export function generateProrationMonths(
  periodMonth: string,
  months: number
): Date[] {
  const [year, month] = periodMonth.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error("periodMonth debe tener formato YYYY-MM");
  }
  return Array.from({ length: months }, (_, i) => new Date(year, month - 1 + i, 1));
}
