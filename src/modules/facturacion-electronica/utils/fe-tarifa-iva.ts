/** Catálogo tarifas IVA Hacienda v4.4 — nota 8.1 */
export type FeTarifaIvaOption = {
  codigo: string;
  percent: number;
  label: string;
  /** Línea gravada con IVA > 0 */
  gravado: boolean;
  /** Solo notas de crédito/débito */
  soloNotas?: boolean;
};

export const FE_TARIFAS_IVA: FeTarifaIvaOption[] = [
  { codigo: "08", percent: 13, label: "08 — 13% Tarifa general", gravado: true },
  { codigo: "04", percent: 4, label: "04 — 4% Tarifa reducida", gravado: true },
  { codigo: "03", percent: 2, label: "03 — 2% Tarifa reducida", gravado: true },
  { codigo: "02", percent: 1, label: "02 — 1% Tarifa reducida", gravado: true },
  { codigo: "09", percent: 0.5, label: "09 — 0.5% Tarifa reducida", gravado: true },
  { codigo: "10", percent: 0, label: "10 — Exento", gravado: false },
  { codigo: "01", percent: 0, label: "01 — 0% (Art. 32 RLIVA)", gravado: false },
  { codigo: "11", percent: 0, label: "11 — 0% sin derecho a crédito", gravado: false },
  { codigo: "05", percent: 0, label: "05 — Transitorio 0% (solo NC/ND)", gravado: false, soloNotas: true },
  { codigo: "06", percent: 4, label: "06 — Transitorio 4% (solo NC/ND)", gravado: true, soloNotas: true },
];

export function feTarifasIvaParaFactura(): FeTarifaIvaOption[] {
  return FE_TARIFAS_IVA.filter((t) => !t.soloNotas);
}

export function feTarifasIvaParaNotas(): FeTarifaIvaOption[] {
  return FE_TARIFAS_IVA;
}

/** Mapeo tarifa % → código tarifa IVA Hacienda (nota 8.1). */
export function tarifaPercentToCodigoTarifaIVA(tarifaPercent: number): string {
  const t = Math.round(tarifaPercent * 100) / 100;
  if (t === 0) return "10";
  if (t === 0.5) return "09";
  if (t === 1) return "02";
  if (t === 2) return "03";
  if (t === 4) return "04";
  if (t === 8) return "07";
  if (t === 13) return "08";
  return "08";
}

/** Código tarifa IVA 01 / 11 = no sujeto o 0% especial (nota 8.1 v4.4). */
export function isLineaNoSujeta(codigoTarifa: string): boolean {
  return codigoTarifa === "01" || codigoTarifa === "11" || codigoTarifa === "05";
}

export function isLineaExenta(codigoTarifa: string, tarifaPercent: number): boolean {
  if (isLineaNoSujeta(codigoTarifa)) return false;
  return codigoTarifa === "10" || tarifaPercent === 0;
}

/** Línea sin monto de IVA (exenta, no sujeta, transitorio 0%, etc.). */
export function isTarifaIvaSinMonto(codigoTarifa: string): boolean {
  const opt = FE_TARIFAS_IVA.find((t) => t.codigo === codigoTarifa);
  if (opt) return !opt.gravado;
  return codigoTarifa === "01" || codigoTarifa === "10" || codigoTarifa === "11" || codigoTarifa === "05";
}

/** Tarifa % sugerida según código tarifa IVA Hacienda. */
export function codigoTarifaToPercent(codigoTarifa: string): number {
  const opt = FE_TARIFAS_IVA.find((t) => t.codigo === codigoTarifa);
  if (opt) return opt.percent;
  switch (codigoTarifa) {
    case "07":
      return 8;
    default:
      return 13;
  }
}

/** CABYS que inicia en 0–4 = mercancía; resto servicios (Anexo 1). */
export function cabysEsMercancia(codigoCabys: string | null | undefined): boolean {
  const d = (codigoCabys ?? "").replace(/\D/g, "");
  if (d.length < 1) return false;
  return ["0", "1", "2", "3", "4"].includes(d[0]!);
}
