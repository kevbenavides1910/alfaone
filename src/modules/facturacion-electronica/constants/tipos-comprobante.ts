import type { FeComprobanteTipo } from "@prisma/client";

/** Códigos oficiales Hacienda CR para consecutivo (posiciones 9-10). */
export const FE_TIPO_COMPROBANTE_CODIGO: Record<FeComprobanteTipo, string> = {
  FACTURA_ELECTRONICA: "01",
  NOTA_DEBITO: "02",
  NOTA_CREDITO: "03",
  TIQUETE_ELECTRONICO: "04",
  MENSAJE_RECEPTOR: "05",
  FACTURA_ELECTRONICA_COMPRA: "08",
  FACTURA_ELECTRONICA_EXPORTACION: "09",
  RECIBO_ELECTRONICO_PAGO: "10",
};

/** Elemento raíz XML v4.4 por tipo de comprobante. */
export const FE_XML_ROOT_BY_TIPO: Record<FeComprobanteTipo, string | null> = {
  FACTURA_ELECTRONICA: "FacturaElectronica",
  NOTA_DEBITO: "NotaDebitoElectronica",
  NOTA_CREDITO: "NotaCreditoElectronica",
  TIQUETE_ELECTRONICO: "TiqueteElectronico",
  MENSAJE_RECEPTOR: "MensajeReceptor",
  FACTURA_ELECTRONICA_EXPORTACION: "FacturaElectronicaExportacion",
  FACTURA_ELECTRONICA_COMPRA: "FacturaElectronicaCompra",
  RECIBO_ELECTRONICO_PAGO: "ReciboElectronicoPago",
};

export const FE_XML_NS_BASE = "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4";

export function feXmlNamespace(tipo: FeComprobanteTipo): string {
  const root = FE_XML_ROOT_BY_TIPO[tipo];
  if (!root) throw new Error(`Tipo sin namespace XML: ${tipo}`);
  return `${FE_XML_NS_BASE}/${root.charAt(0).toLowerCase()}${root.slice(1)}`;
}

/** Tipos de venta/compra que usan FeFactura o tablas hermanas. */
export const FE_TIPOS_DOCUMENTO_VENTA = [
  "FACTURA_ELECTRONICA",
  "TIQUETE_ELECTRONICO",
  "FACTURA_ELECTRONICA_EXPORTACION",
] as const satisfies readonly FeComprobanteTipo[];

export type FeTipoDocumentoVenta = (typeof FE_TIPOS_DOCUMENTO_VENTA)[number];

export const FE_TIPO_DOCUMENTO_LABEL: Partial<Record<FeComprobanteTipo, string>> = {
  FACTURA_ELECTRONICA: "Factura electrónica",
  TIQUETE_ELECTRONICO: "Tiquete electrónico",
  FACTURA_ELECTRONICA_EXPORTACION: "Factura electrónica de exportación",
  FACTURA_ELECTRONICA_COMPRA: "Factura electrónica de compra",
  RECIBO_ELECTRONICO_PAGO: "Recibo electrónico de pago",
  NOTA_CREDITO: "Nota de crédito",
  NOTA_DEBITO: "Nota de débito",
};

export const FE_PDF_PREFIX: Partial<Record<FeComprobanteTipo, string>> = {
  FACTURA_ELECTRONICA: "FE",
  TIQUETE_ELECTRONICO: "TE",
  FACTURA_ELECTRONICA_EXPORTACION: "FEE",
  FACTURA_ELECTRONICA_COMPRA: "FEC",
  RECIBO_ELECTRONICO_PAGO: "REP",
};

export function feTipoDocReferenciaFromComprobante(tipo: FeComprobanteTipo | null | undefined): string {
  return FE_TIPO_COMPROBANTE_CODIGO[tipo ?? "FACTURA_ELECTRONICA"] ?? "01";
}
