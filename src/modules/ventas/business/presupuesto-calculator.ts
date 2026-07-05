import type { VentasEquipamiento } from "@prisma/client";
import type { VentasInsumoVariante } from "@prisma/client";
import { PANI_EXCEL_2026 } from "./pani-excel-reference";

export type PresupuestoConfig = {
  anioBase: number;
  polizaInsPct: number;
  ivaPct: number;
  margenUtilidadPct: number;
  imprevistosPct: number;
};

export type LineaInput = {
  numeroLinea: string;
  descripcion: string;
  jornadaCodigo: string;
  equipamiento: VentasEquipamiento;
  cantidadPuestos: number;
  factorOficiales: number;
  codigoHojaInsumo?: string | null;
};

export type LineaCalculo = {
  costoMo: number;
  costoGa: number;
  costoInDirecto: number;
  costoInIndirecto: number;
  imprevistos: number;
  margenUtilidad: number;
  precioMensual: number;
  precioAnual: number;
  precioConIva: number;
  desglose: Record<string, number | string>;
};

export type JornadaMoRef = {
  codigo: string;
  costoMoReferencia: unknown;
};

export type CatalogSnapshot = {
  jornadas: JornadaMoRef[];
  insumoVariantes: VentasInsumoVariante[];
  gaTotalMensual?: number;
};

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function costoMoJornada(jornadaCodigo: string, jornadas: JornadaMoRef[]): number {
  const j = jornadas.find((x) => x.codigo === jornadaCodigo);
  const ref = j ? n(j.costoMoReferencia) : 0;
  if (ref > 0) return ref;
  const legacy = PANI_EXCEL_2026.moCostoReferencia as Record<string, number>;
  return legacy[jornadaCodigo] ?? 0;
}

/** Insumo directo según equipamiento + factor (hojas 3,89AF, 1ANL, etc.). */
export function costoInsumoVariante(
  equipamiento: VentasEquipamiento,
  factorOficiales: number,
  variantes: VentasInsumoVariante[],
  codigoHojaInsumo?: string | null
): { monto: number; codigoHoja: string | null } {
  const active = variantes.filter((v) => v.isActive);
  if (codigoHojaInsumo) {
    const byHoja = active.find((v) => v.codigoHoja === codigoHojaInsumo);
    if (byHoja) return { monto: n(byHoja.montoMensual), codigoHoja: byHoja.codigoHoja };
  }
  const exact = active.find(
    (v) => v.equipamiento === equipamiento && Math.abs(n(v.factorOficiales) - factorOficiales) < 0.001
  );
  if (exact) return { monto: n(exact.montoMensual), codigoHoja: exact.codigoHoja };

  const sameEq = active
    .filter((v) => v.equipamiento === equipamiento)
    .sort(
      (a, b) =>
        Math.abs(n(a.factorOficiales) - factorOficiales) -
        Math.abs(n(b.factorOficiales) - factorOficiales)
    );
  if (sameEq[0]) return { monto: n(sameEq[0].montoMensual), codigoHoja: sameEq[0].codigoHoja };

  const fallback = PANI_EXCEL_2026.insumoVariantes.find(
    (v) => v.equipamiento === equipamiento
  );
  return fallback
    ? { monto: fallback.montoMensual, codigoHoja: fallback.codigoHoja }
    : { monto: 0, codigoHoja: null };
}

/**
 * Fórmula hoja DETALLE (PANI):
 * H=MO, J=GA, L=IN-D, N=P=(H+J+L)*imprev%, P=IMP, R=(H+J+L+N+P)*MU%, T=suma
 */
export function calcularLinea(
  linea: LineaInput,
  catalog: CatalogSnapshot,
  config: PresupuestoConfig
): LineaCalculo {
  const puestos = linea.cantidadPuestos;
  const moUnit = costoMoJornada(linea.jornadaCodigo, catalog.jornadas);
  const gaUnit = catalog.gaTotalMensual ?? PANI_EXCEL_2026.gaTotalMensual;
  const insumo = costoInsumoVariante(
    linea.equipamiento,
    linea.factorOficiales,
    catalog.insumoVariantes,
    linea.codigoHojaInsumo
  );

  const costoMo = moUnit * puestos;
  const costoGa = gaUnit * puestos;
  const costoInDirecto = insumo.monto * puestos;

  const baseImp = costoMo + costoGa + costoInDirecto;
  const imprevistos = baseImp * (config.imprevistosPct / 100);
  const costoInIndirecto = imprevistos;

  const baseMu = costoMo + costoGa + costoInDirecto + costoInIndirecto + imprevistos;
  const margenUtilidad = baseMu * (config.margenUtilidadPct / 100);
  const precioMensual = baseMu + margenUtilidad;
  const precioAnual = precioMensual * 12;
  const precioConIva = precioMensual * (1 + config.ivaPct / 100);

  return {
    costoMo: round2(costoMo),
    costoGa: round2(costoGa),
    costoInDirecto: round2(costoInDirecto),
    costoInIndirecto: round2(costoInIndirecto),
    imprevistos: round2(imprevistos),
    margenUtilidad: round2(margenUtilidad),
    precioMensual: round2(precioMensual),
    precioAnual: round2(precioAnual),
    precioConIva: round2(precioConIva),
    desglose: {
      moUnitario: round2(moUnit),
      gaUnitario: round2(gaUnit),
      insumoUnitario: round2(insumo.monto),
      insumoHoja: insumo.codigoHoja ?? "",
      puestos,
      factorOficiales: linea.factorOficiales,
    },
  };
}

export function calcularEstructuraResumen(lineas: LineaCalculo[], config: PresupuestoConfig) {
  const totalMensual = lineas.reduce((s, l) => s + l.precioMensual, 0);
  const cdmo = lineas.reduce((s, l) => s + l.costoMo, 0);
  const cdi = lineas.reduce((s, l) => s + l.costoInDirecto, 0);
  const cimo = lineas.reduce((s, l) => s + l.costoGa, 0);
  const cii = lineas.reduce((s, l) => s + l.costoInIndirecto, 0);
  const imprev = lineas.reduce((s, l) => s + l.imprevistos, 0);
  const mu = lineas.reduce((s, l) => s + l.margenUtilidad, 0);
  const pct = (v: number) => (totalMensual > 0 ? round2((v / totalMensual) * 100) : 0);

  return {
    totalMensual: round2(totalMensual),
    totalAnual: round2(totalMensual * 12),
    totalConIva: round2(totalMensual * (1 + config.ivaPct / 100)),
    componentes: {
      CDmo: { monto: round2(cdmo), pct: pct(cdmo) },
      CDi: { monto: round2(cdi), pct: pct(cdi) },
      CImo: { monto: round2(cimo), pct: pct(cimo) },
      CIi: { monto: round2(cii), pct: pct(cii) },
      I: { monto: round2(imprev), pct: pct(imprev) },
      MU: { monto: round2(mu), pct: pct(mu) },
    },
  };
}
