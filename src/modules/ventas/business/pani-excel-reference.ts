/**
 * Referencia calibrada desde CÁLCULO COSTOS 2026 PANI.xlsx
 * Hoja DETALLE: T = H+J+L+N+P+R; IMP = (H+J+L)*0.0001; MU = VLOOKUP margen 7%
 */
export const PANI_EXCEL_2026 = {
  licitacionNo: "2025LY-000006-0006100001",
  compania: "SEGURIDAD TANGO S.A",
  ivaPct: 13,
  polizaInsPct: 5.75,
  margenUtilidadPct: 7.523687797366793,
  imprevistosPct: 0.01,
  gaTotalMensual: 200352.95369565213,
  cargasSocialesPct: 46.24,
  moCostoReferencia: {
    MO1: 2972950.0578496186,
    MO2: 665574.0145724074,
    MO3: 736073.7510185298,
    MO4: 1702887.8173443237,
    MO5: 930686.4114631531,
  } as Record<string, number>,
  insumoVariantes: [
    { codigoHoja: "3,89AF", equipamiento: "AF", factorOficiales: 3.89, montoMensual: 58275.29069166667 },
    { codigoHoja: "3,89AF-L", equipamiento: "L", factorOficiales: 3.89, montoMensual: 60025.29069166667 },
    { codigoHoja: "1AF", equipamiento: "AF", factorOficiales: 1, montoMensual: 41642.685625 },
    { codigoHoja: "3,89ANL", equipamiento: "ANL", factorOficiales: 3.89, montoMensual: 57008.794025 },
    { codigoHoja: "1ANL", equipamiento: "ANL", factorOficiales: 1, montoMensual: 40376.18895833334 },
    { codigoHoja: "1,5SA", equipamiento: "SA", factorOficiales: 1.5, montoMensual: 40128.80229166667 },
    { codigoHoja: "2,5SA", equipamiento: "SA", factorOficiales: 2.5, montoMensual: 40128.80229166667 },
    { codigoHoja: "3,89SA", equipamiento: "SA", factorOficiales: 3.89, montoMensual: 40128.80229166667 },
    { codigoHoja: "3,89AMBAS", equipamiento: "SA", factorOficiales: 3.89, montoMensual: 61400.29069166667 },
    { codigoHoja: "3,89AMBAS-L", equipamiento: "SA", factorOficiales: 3.89, montoMensual: 63150.29069166667 },
  ],
} as const;
