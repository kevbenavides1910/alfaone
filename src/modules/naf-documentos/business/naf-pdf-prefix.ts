/** Prefijo de nombre de archivo PDF según tipo de documento NAF (ARFAFE.TIPO_DOC). */
export function nafPdfPrefix(tipoDoc: string): string | null {
  switch (tipoDoc.trim().toUpperCase()) {
    case "FC":
      return "FE";
    case "NC":
      return "NC";
    case "ND":
      return "ND";
    case "AN":
      return "NC";
    case "RP":
      return "REP";
    case "RE":
      return "RE";
    default:
      return null;
  }
}

export function nafPdfFileName(tipoDoc: string, consecutivoFe: string): string | null {
  const prefix = nafPdfPrefix(tipoDoc);
  const consecutivo = consecutivoFe.trim();
  if (!prefix || !consecutivo) return null;
  return `${prefix}-${consecutivo}.pdf`;
}
