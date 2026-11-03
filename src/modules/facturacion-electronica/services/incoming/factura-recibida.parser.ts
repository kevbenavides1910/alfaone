import { DOMParser } from "@xmldom/xmldom";

type XmlDocument = ReturnType<DOMParser["parseFromString"]>;

export type FeFacturaRecibidaParsed = {
  clave: string;
  cedulaEmisor: string;
  nombreEmisor: string | null;
  consecutivo: string | null;
  fechaEmision: Date | null;
  montoTotal: number | null;
  montoTotalImpuesto: number | null;
  tipoComprobante: string | null;
};

const ROOT_NAMES = new Set([
  "FacturaElectronica",
  "TiqueteElectronico",
  "NotaCreditoElectronica",
  "NotaDebitoElectronica",
  "FacturaElectronicaCompra",
  "FacturaElectronicaExportacion",
]);

function textOf(doc: XmlDocument, tag: string): string | null {
  const nodes = doc.getElementsByTagName(tag);
  if (!nodes.length) return null;
  const value = nodes.item(0)?.textContent?.trim();
  return value || null;
}

function numOf(doc: XmlDocument, tag: string): number | null {
  const raw = textOf(doc, tag);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseFecha(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function cedulaFromEmisor(doc: XmlDocument): string | null {
  const emisores = doc.getElementsByTagName("Emisor");
  if (!emisores.length) return null;
  const emisor = emisores.item(0);
  if (!emisor) return null;
  const ident = emisor.getElementsByTagName("Identificacion").item(0);
  const numero = ident?.getElementsByTagName("Numero").item(0)?.textContent?.trim();
  if (!numero) return null;
  const compact = numero.toUpperCase().replace(/[^0-9A-Z]/g, "");
  return /[A-Z]/.test(compact) ? compact : compact.replace(/\D/g, "");
}

function nombreFromEmisor(doc: XmlDocument): string | null {
  const emisores = doc.getElementsByTagName("Emisor");
  const emisor = emisores.item(0);
  return emisor?.getElementsByTagName("Nombre").item(0)?.textContent?.trim() ?? null;
}

export function isFeComprobanteXml(xml: string): boolean {
  const trimmed = xml.trim();
  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) return false;
  for (const root of ROOT_NAMES) {
    if (trimmed.includes(`<${root}`) || trimmed.includes(`:${root}`)) return true;
  }
  return trimmed.includes("<Clave>") && trimmed.includes("<Emisor>");
}

export function parseFacturaRecibidaXml(xml: string): FeFacturaRecibidaParsed | null {
  if (!isFeComprobanteXml(xml)) return null;

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const clave = normalizeFeClave(textOf(doc, "Clave") ?? "");
  if (!isValidFeClave(clave)) return null;

  const cedulaEmisor = cedulaFromEmisor(doc);
  if (!cedulaEmisor) return null;

  const root = doc.documentElement?.localName ?? doc.documentElement?.nodeName ?? null;

  return {
    clave,
    cedulaEmisor,
    nombreEmisor: nombreFromEmisor(doc),
    consecutivo: textOf(doc, "NumeroConsecutivo"),
    fechaEmision: parseFecha(textOf(doc, "FechaEmision")),
    montoTotal: numOf(doc, "TotalComprobante"),
    montoTotalImpuesto: numOf(doc, "TotalImpuesto") ?? numOf(doc, "MontoTotalImpuesto"),
    tipoComprobante: root,
  };
}

/** Clave FE Costa Rica: 50 posiciones. Puede incluir letras si la cédula jurídica es alfanumérica. */
export function isValidFeClave(clave: string | null | undefined): clave is string {
  const value = normalizeFeClave(clave ?? "");
  return /^506[0-9A-Z]{47}$/.test(value);
}

export function normalizeFeClave(clave: string): string {
  return clave.trim().toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 50);
}

/** Intenta extraer clave FE de texto PDF (50 posiciones, prefijo 506). */
export function extractClaveFromText(text: string): string | null {
  const match = text.toUpperCase().match(/506[0-9A-Z]{47}/);
  return match?.[0] ?? null;
}

export async function extractClaveFromPdfBuffer(buffer: Buffer): Promise<string | null> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    return extractClaveFromText(parsed.text ?? "");
  } catch {
    return null;
  }
}
