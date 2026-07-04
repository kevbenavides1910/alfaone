/** Decodifica respuesta-xml de Hacienda (base64 o XML literal). */
export function decodeHaciendaRespuestaXml(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("<")) return trimmed;

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8");
    if (decoded.includes("<") && decoded.includes(">")) return decoded;
  } catch {
    /* base64 inválido */
  }

  return null;
}

/** Extrae el XML de acuse/respuesta desde el cuerpo JSON o XML de consulta Hacienda. */
export function extractRespuestaXmlFromConsultaRaw(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("<")) return trimmed;

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    for (const key of ["respuesta-xml", "respuestaXml", "respuesta_xml"]) {
      const value = json[key];
      if (typeof value === "string") {
        const decoded = decodeHaciendaRespuestaXml(value);
        if (decoded) return decoded;
      }
    }
  } catch {
    /* no es JSON */
  }

  return null;
}

/** Resumen JSON para BD sin el base64 enorme de respuesta-xml. */
export function summarizeHaciendaConsultaRaw(raw: string, maxLen = 8000): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const copy = { ...json };
    for (const key of ["respuesta-xml", "respuestaXml", "respuesta_xml"]) {
      if (typeof copy[key] === "string" && copy[key]) {
        copy[key] = "[xml persistido en archivo]";
      }
    }
    const summarized = JSON.stringify(copy);
    return summarized.length <= maxLen ? summarized : summarized.slice(0, maxLen);
  } catch {
    return trimmed.length <= maxLen ? trimmed : trimmed.slice(0, maxLen);
  }
}
