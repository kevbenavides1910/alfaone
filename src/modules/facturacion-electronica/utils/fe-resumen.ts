import type { FeMedioPago } from "@prisma/client";
import { FE_MEDIO_PAGO_CODIGO } from "../constants/hacienda-catalogos";
import { cabysEsMercancia, isLineaExenta, isLineaNoSujeta, tarifaPercentToCodigoTarifaIVA } from "./fe-tarifa-iva";

export type FeExoneracionInput = {
  exonTipoDocumento?: string | null;
  exonNumeroDocumento?: string | null;
  exonNombreInstitucion?: string | null;
  exonFechaEmision?: Date | string | null;
  exonPorcentaje?: number | null;
  exonMonto?: number | null;
};

export type FeLineaCalculoInput = FeExoneracionInput & {
  cantidad: number;
  precioUnitario: number;
  montoDescuento: number;
  codigoCabys?: string | null;
  codigoTarifa?: string | null;
  tarifaImpuesto: number;
  montoImpuesto: number;
  totalLinea: number;
  ivaCobradoFabrica?: string | null;
  impuestoAsumidoFabrica?: number;
};

export type FeLineaCalculada = FeLineaCalculoInput & {
  montoTotal: number;
  subTotal: number;
  baseImponible: number;
  codigoTarifaIVA: string;
  esMercancia: boolean;
  esExenta: boolean;
  esNoSujeta: boolean;
  tieneExoneracion: boolean;
  exonMontoCalculado: number;
  impuestoNeto: number;
  impuestoAsumidoFabrica: number;
};

export type FeDesgloseImpuesto = {
  codigo: string;
  codigoTarifaIVA: string;
  totalMontoImpuesto: number;
};

export type FeMedioPagoLinea = {
  tipo: FeMedioPago;
  total: number;
  otro?: string | null;
};

export type FeOtroCargoLinea = {
  tipoDocumento: string;
  detalle: string;
  montoCargo: number;
  numeroIdentidadTercero?: string | null;
  nombreTercero?: string | null;
  porcentaje?: number | null;
};

export type FeResumenOptions = {
  totalComprobanteOverride?: number;
  totalOtrosCargos?: number;
  otrosCargos?: unknown;
  totalIvaDevuelto?: number;
};

export type FeResumenCalculado = {
  lineas: FeLineaCalculada[];
  totalServiciosGravados: number;
  totalServiciosExentos: number;
  totalServiciosExonerados: number;
  totalServiciosNoSujeto: number;
  totalMercanciasGravadas: number;
  totalMercanciasExentas: number;
  totalMercanciasExoneradas: number;
  totalMercanciasNoSujetas: number;
  totalGravado: number;
  totalExento: number;
  totalExonerado: number;
  totalNoSujeto: number;
  totalVenta: number;
  totalDescuentos: number;
  totalVentaNeta: number;
  desgloseImpuestos: FeDesgloseImpuesto[];
  totalImpuesto: number;
  totalImpAsumEmisorFabrica: number;
  totalOtrosCargos: number;
  otrosCargos: FeOtroCargoLinea[];
  totalIvaDevuelto: number;
  totalComprobante: number;
};

function dec(value: { toString(): string } | number | string): number {
  return Number(value.toString());
}

export function lineaTieneExoneracion(line: { exonNumeroDocumento?: string | null }): boolean {
  return Boolean(line.exonNumeroDocumento?.trim());
}

export function calcularExonMonto(subTotal: number, line: FeExoneracionInput): number {
  const stored = line.exonMonto != null ? dec(line.exonMonto) : 0;
  if (stored > 0) return stored;
  const pct = line.exonPorcentaje != null ? dec(line.exonPorcentaje) : 0;
  if (pct > 0) return Math.round(subTotal * (pct / 100) * 100000) / 100000;
  return 0;
}

export function calcularLinea(line: FeLineaCalculoInput): FeLineaCalculada {
  const cantidad = dec(line.cantidad);
  const precio = dec(line.precioUnitario);
  const descuento = dec(line.montoDescuento);
  const montoTotal = cantidad * precio;
  const subTotal = Math.max(0, montoTotal - descuento);
  const tieneExoneracion = lineaTieneExoneracion(line);
  const ivaFabrica = line.ivaCobradoFabrica?.trim() || null;
  const impuestoAsumidoFabrica = dec(line.impuestoAsumidoFabrica ?? 0);

  let codigoTarifaIVA = line.codigoTarifa?.trim() || tarifaPercentToCodigoTarifaIVA(dec(line.tarifaImpuesto));
  if (ivaFabrica === "02") codigoTarifaIVA = "10";

  const esNoSujeta = isLineaNoSujeta(codigoTarifaIVA);
  const esExenta = isLineaExenta(codigoTarifaIVA, dec(line.tarifaImpuesto)) || ivaFabrica === "02";
  const baseImponible = esExenta || esNoSujeta || tieneExoneracion ? 0 : subTotal;
  const exonMontoCalculado = tieneExoneracion ? calcularExonMonto(subTotal, line) : 0;
  const montoImpuestoBruto = dec(line.montoImpuesto);
  const impuestoNeto = Math.max(0, montoImpuestoBruto - exonMontoCalculado - impuestoAsumidoFabrica);

  return {
    ...line,
    montoTotal,
    subTotal,
    baseImponible,
    codigoTarifaIVA,
    esMercancia: cabysEsMercancia(line.codigoCabys),
    esExenta,
    esNoSujeta,
    tieneExoneracion,
    exonMontoCalculado,
    impuestoNeto,
    impuestoAsumidoFabrica,
  };
}

export function calcularResumen(
  lineasInput: FeLineaCalculoInput[],
  options: FeResumenOptions = {}
): FeResumenCalculado {
  const lineas = lineasInput.map(calcularLinea);

  let totalServiciosGravados = 0;
  let totalServiciosExentos = 0;
  let totalServiciosExonerados = 0;
  let totalServiciosNoSujeto = 0;
  let totalMercanciasGravadas = 0;
  let totalMercanciasExentas = 0;
  let totalMercanciasExoneradas = 0;
  let totalMercanciasNoSujetas = 0;
  let totalDescuentos = 0;
  let totalImpuesto = 0;
  let totalImpAsumEmisorFabrica = 0;

  const desgloseMap = new Map<string, FeDesgloseImpuesto>();

  for (const l of lineas) {
    totalDescuentos += dec(l.montoDescuento);
    totalImpuesto += l.impuestoNeto;
    totalImpAsumEmisorFabrica += l.impuestoAsumidoFabrica;

    if (l.tieneExoneracion) {
      if (l.esMercancia) totalMercanciasExoneradas += l.subTotal;
      else totalServiciosExonerados += l.subTotal;
      continue;
    }

    if (l.esNoSujeta) {
      if (l.esMercancia) totalMercanciasNoSujetas += l.subTotal;
      else totalServiciosNoSujeto += l.subTotal;
      continue;
    }

    if (l.esMercancia) {
      if (l.esExenta) totalMercanciasExentas += l.subTotal;
      else totalMercanciasGravadas += l.subTotal;
    } else if (l.esExenta) {
      totalServiciosExentos += l.subTotal;
    } else {
      totalServiciosGravados += l.subTotal;
    }

    if (l.impuestoNeto > 0) {
      const key = `01:${l.codigoTarifaIVA}`;
      const prev = desgloseMap.get(key);
      desgloseMap.set(key, {
        codigo: "01",
        codigoTarifaIVA: l.codigoTarifaIVA,
        totalMontoImpuesto: (prev?.totalMontoImpuesto ?? 0) + l.impuestoNeto,
      });
    }
  }

  const totalGravado = totalServiciosGravados + totalMercanciasGravadas;
  const totalExento = totalServiciosExentos + totalMercanciasExentas;
  const totalExonerado = totalServiciosExonerados + totalMercanciasExoneradas;
  const totalNoSujeto = totalServiciosNoSujeto + totalMercanciasNoSujetas;
  const totalVenta = lineas.reduce((s, l) => s + l.montoTotal, 0);
  const totalVentaNeta = totalGravado + totalExento + totalExonerado + totalNoSujeto;
  const otrosCargos = resolveOtrosCargos(options);
  const totalOtrosCargos =
    otrosCargos.length > 0
      ? otrosCargos.reduce((s, c) => s + c.montoCargo, 0)
      : dec(options.totalOtrosCargos ?? 0);
  const totalIvaDevuelto = dec(options.totalIvaDevuelto ?? 0);
  const totalComprobanteCalc =
    Math.round((totalVentaNeta + totalImpuesto + totalOtrosCargos - totalIvaDevuelto) * 100000) / 100000;
  const totalComprobante = options.totalComprobanteOverride ?? totalComprobanteCalc;

  return {
    lineas,
    totalServiciosGravados,
    totalServiciosExentos,
    totalServiciosExonerados,
    totalServiciosNoSujeto,
    totalMercanciasGravadas,
    totalMercanciasExentas,
    totalMercanciasExoneradas,
    totalMercanciasNoSujetas,
    totalGravado,
    totalExento,
    totalExonerado,
    totalNoSujeto,
    totalVenta,
    totalDescuentos,
    totalVentaNeta,
    desgloseImpuestos: [...desgloseMap.values()],
    totalImpuesto,
    totalImpAsumEmisorFabrica,
    totalOtrosCargos,
    otrosCargos,
    totalIvaDevuelto,
    totalComprobante,
  };
}

export function resolveOtrosCargos(options: {
  otrosCargos?: unknown;
  totalOtrosCargos?: number;
}): FeOtroCargoLinea[] {
  if (Array.isArray(options.otrosCargos) && options.otrosCargos.length > 0) {
    const rows: FeOtroCargoLinea[] = [];
    for (const row of options.otrosCargos) {
      const r = row as FeOtroCargoLinea;
      const monto = Number(r.montoCargo ?? 0);
      const detalle = (r.detalle ?? "").trim();
      const tipo = (r.tipoDocumento ?? "").trim();
      if (!tipo || !detalle || monto <= 0) continue;
      rows.push({
        tipoDocumento: tipo.slice(0, 2),
        detalle: detalle.slice(0, 160),
        montoCargo: monto,
        numeroIdentidadTercero: r.numeroIdentidadTercero?.trim() || undefined,
        nombreTercero: r.nombreTercero?.trim() || undefined,
        porcentaje: r.porcentaje != null ? Number(r.porcentaje) : undefined,
      });
    }
    if (rows.length > 0) return rows;
  }
  return [];
}

export function resolveMediosPago(params: {
  medioPago: FeMedioPago;
  medioPagoOtro?: string | null;
  mediosPago?: unknown;
  totalComprobante: number;
}): FeMedioPagoLinea[] {
  if (Array.isArray(params.mediosPago) && params.mediosPago.length > 0) {
    const rows: FeMedioPagoLinea[] = [];
    for (const row of params.mediosPago) {
      const r = row as { tipo?: FeMedioPago; total?: number; otro?: string };
      if (!r.tipo || Number(r.total ?? 0) <= 0) continue;
      rows.push({
        tipo: r.tipo,
        total: Number(r.total),
        otro: r.otro,
      });
    }
    if (rows.length > 0) return rows;
  }

  return [
    {
      tipo: params.medioPago,
      total: params.totalComprobante,
      otro: params.medioPago === "OTROS" ? params.medioPagoOtro : undefined,
    },
  ];
}

export function medioPagoCodigo(tipo: FeMedioPago): string {
  return FE_MEDIO_PAGO_CODIGO[tipo];
}

export function fmtDecimal(value: number, digits = 5): string {
  return value.toFixed(digits);
}
