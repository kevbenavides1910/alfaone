/** Código de tipo en el nombre de archivo del share SMB (ej. FAC, NC, TQ). */
const HACIENDA_TIPO_TO_SHARE: Record<string, string> = {
  "01": "FAC",
  "02": "ND",
  "03": "NC",
  "04": "TQ",
  "08": "FEC",
  "09": "FEE",
  "10": "REP",
};

const NAF_TIPO_TO_SHARE: Record<string, string> = {
  FC: "FAC",
  NC: "NC",
  ND: "ND",
  AN: "NC",
  RP: "REP",
  RE: "RE",
  NT: "NC",
};

/** Extrae el código de tipo Hacienda (pos. 9-10) del consecutivo de 20 dígitos. */
export function haciendaTipoFromConsecutivo(consecutivoFe: string): string | null {
  const c = consecutivoFe.trim();
  if (c.length < 10) return null;
  return c.slice(8, 10);
}

export function nafShareTipoCode(tipoDoc: string, consecutivoFe: string): string {
  const fromNaf = NAF_TIPO_TO_SHARE[tipoDoc.trim().toUpperCase()];
  if (fromNaf) return fromNaf;

  const hacienda = haciendaTipoFromConsecutivo(consecutivoFe);
  if (hacienda && HACIENDA_TIPO_TO_SHARE[hacienda]) {
    return HACIENDA_TIPO_TO_SHARE[hacienda];
  }

  return "FAC";
}

/** Nombre en el share: 01_NC_00100001030000000792_FAE.PDF */
export function nafSharePdfFileName(
  noCia: string,
  tipoDoc: string,
  consecutivoFe: string,
): string | null {
  const consecutivo = consecutivoFe.trim();
  if (!consecutivo) return null;

  const cia = noCia.trim().padStart(2, "0");
  const tipo = nafShareTipoCode(tipoDoc, consecutivo);
  return `${cia}_${tipo}_${consecutivo}_FAE.PDF`;
}

export function nafSharePdfCandidates(
  noCia: string,
  tipoDoc: string,
  consecutivoFe: string,
): string[] {
  const primary = nafSharePdfFileName(noCia, tipoDoc, consecutivoFe);
  if (!primary) return [];

  const candidates = new Set<string>([primary]);
  const hacienda = haciendaTipoFromConsecutivo(consecutivoFe);
  if (hacienda) {
    const alt = HACIENDA_TIPO_TO_SHARE[hacienda];
    if (alt) {
      const cia = noCia.trim().padStart(2, "0");
      candidates.add(`${cia}_${alt}_${consecutivoFe.trim()}_FAE.PDF`);
    }
  }
  return [...candidates];
}
