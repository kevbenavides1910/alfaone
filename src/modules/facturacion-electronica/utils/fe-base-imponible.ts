/** Base gravable a partir del IVA y la tarifa (útil para D-104 / declaración). */
export function baseImponibleDesdeIva(montoImpuesto: number, tarifaPercent: number): number {
  const iva = Number(montoImpuesto);
  const tarifa = Number(tarifaPercent);
  if (!Number.isFinite(iva) || !Number.isFinite(tarifa) || tarifa <= 0) return 0;
  return Math.round((iva * 100) / tarifa * 100000) / 100000;
}

/** Neto de línea antes de impuesto: cantidad × precio − descuento. */
export function baseLineaDetalle(params: {
  cantidad: number | string;
  precioUnitario: number | string;
  montoDescuento?: number | string | null;
}): number {
  const cantidad = Number(params.cantidad);
  const precio = Number(params.precioUnitario);
  const descuento = Number(params.montoDescuento ?? 0);
  if (!Number.isFinite(cantidad) || !Number.isFinite(precio)) return 0;
  const base = cantidad * precio - (Number.isFinite(descuento) ? descuento : 0);
  return Math.round(Math.max(0, base) * 100000) / 100000;
}
