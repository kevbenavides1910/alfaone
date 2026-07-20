/**
 * Lógica pura de cálculo de totales de línea para facturación electrónica.
 *
 * Extraída del componente FeNotaForm para poder ser reutilizada y testeada
 * sin depender de React / la UI.
 */

export type LineaForm = {
  key: string;
  descripcion: string;
  cantidad: string;
  unidadMedida: string;
  precioUnitario: string;
  montoDescuento: string;
  tarifaImpuesto: string;
  codigoCabys: string;
};

export type LineTotals = {
  base: number;
  montoImpuesto: number;
  totalLinea: number;
};

/**
 * Calcula base, impuesto y total de una línea de facturación electrónica.
 *
 * - cantidad * precioUnitario = subtotal bruto
 * - descuento se aplica sobre el bruto
 * - base imponible = max(0, bruto - descuento)
 * - impuesto = redondeo(base * tarifa / 100, 2 decimales)
 * - total = redondeo(base + impuesto, 2 decimales)
 */
export function lineTotals(line: LineaForm): LineTotals {
  const cantidad = Number(line.cantidad) || 0;
  const precio = Number(line.precioUnitario) || 0;
  const descuento = Number(line.montoDescuento) || 0;
  const tarifa = Number(line.tarifaImpuesto) || 0;

  const base = Math.max(0, cantidad * precio - descuento);
  const montoImpuesto = Math.round(base * (tarifa / 100) * 100) / 100;
  const totalLinea = Math.round((base + montoImpuesto) * 100) / 100;

  return { base, montoImpuesto, totalLinea };
}
