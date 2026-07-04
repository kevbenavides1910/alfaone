/** Código tipo documento Hacienda (posiciones 9-10 del consecutivo FE de 20 dígitos). */
export const NAF_FAE_TD_BY_NAF_TIPO: Record<string, string> = {
  FC: "01",
  ND: "02",
  NC: "03",
  AN: "03",
  RP: "10",
  RE: "10",
};

export function nafFaeTipoFromConsecutivo(consecutivoFe: string | null | undefined): string | null {
  const c = consecutivoFe?.trim();
  if (!c || c.length < 10) return null;
  const td = c.slice(8, 10);
  return /^\d{2}$/.test(td) ? td : null;
}

export function nafFaeTipoCodes(tipoDoc: string, consecutivoFe: string | null | undefined): string[] {
  const codes = new Set<string>();
  const fromTipo = NAF_FAE_TD_BY_NAF_TIPO[tipoDoc.trim().toUpperCase()];
  if (fromTipo) codes.add(fromTipo);
  const fromConsec = nafFaeTipoFromConsecutivo(consecutivoFe);
  if (fromConsec) codes.add(fromConsec);
  return [...codes];
}
