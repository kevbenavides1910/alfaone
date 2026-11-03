import type { FeAmbiente } from "@prisma/client";

/** Códigos oficiales catálogo Hacienda CR v4.4 */
export const FE_IDENTIFICACION_CODIGO = {
  FISICA: "01",
  JURIDICA: "02",
  DIMEX: "03",
  NITE: "04",
  EXTRANJERO: "05",
  NO_CONTRIBUYENTE: "06",
} as const;

export const FE_CONDICION_VENTA_CODIGO = {
  CONTADO: "01",
  CREDITO: "02",
  CONSIGNACION: "03",
  APARTADO: "04",
  ARRENDAMIENTO_OPCION_COMPRA: "05",
  ARRENDAMIENTO_FUNCION_FINANCIERA: "06",
  VENTA_MERCANCIA_NO_NACIONALIZADA: "12",
  VENTA_BIENES_USADOS: "13",
  ARRENDAMIENTO_OPERATIVO: "14",
  ARRENDAMIENTO_FINANCIERO: "15",
  PAGO_SERVICIOS_ESTADO: "08",
  VENTA_CREDITO_IVA_90_DIAS: "09",
  PAGO_VENTA_PARCELADO: "10",
  PAGO_VENTA_CREDITO: "11",
  OTROS: "99",
} as const;

export const FE_MEDIO_PAGO_CODIGO = {
  EFECTIVO: "01",
  TARJETA: "02",
  CHEQUE: "03",
  TRANSFERENCIA_DEPOSITO: "04",
  RECAUDADO_TERCEROS: "05",
  SINPE_MOVIL: "06",
  PLATAFORMA_DIGITAL: "07",
  OTROS: "99",
} as const;

export const FE_MONEDA_CODIGO = {
  CRC: { codigo: "CRC", tipoCambio: 1 },
  USD: { codigo: "USD", tipoCambio: 1 },
  EUR: { codigo: "EUR", tipoCambio: 1 },
} as const;

/**
 * Nota 9 — código de referencia (anexo 4.4, bitácora 22/04/2026, obligatorio desde el 1/11/2026).
 * 15 y 16 van en el comprobante que sustituye, no en la nota.
 * 17 es exclusivo del recibo electrónico de pago.
 */
export const FE_CODIGO_REFERENCIA_NOTA = [
  "01",
  "02",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "99",
] as const;

export const FE_CODIGO_REFERENCIA_REP = ["17"] as const;

/** Códigos de la nota 9 que van en el comprobante nuevo, no en la nota. */
export const FE_CODIGO_SUSTITUCION = ["07", "15", "16"] as const;

export const FE_TIPO_DOC_IR_SUSTITUCION = ["01", "02", "03", "04", "19"] as const;

export type FeCodigoReferenciaNota = (typeof FE_CODIGO_REFERENCIA_NOTA)[number];

type FeCodigoReferenciaMeta = {
  codigo: string;
  descripcion: string;
  enNotaCredito: boolean;
  enNotaDebito: boolean;
};

export const FE_CODIGOS_REFERENCIA: FeCodigoReferenciaMeta[] = [
  { codigo: "01", descripcion: "Anula documento de referencia", enNotaCredito: true, enNotaDebito: true },
  { codigo: "02", descripcion: "Corrige monto", enNotaCredito: true, enNotaDebito: true },
  { codigo: "04", descripcion: "Referencia a otro documento", enNotaCredito: true, enNotaDebito: true },
  { codigo: "05", descripcion: "Sustituye comprobante provisional por contingencia", enNotaCredito: true, enNotaDebito: true },
  { codigo: "06", descripcion: "Devolución de mercancía", enNotaCredito: true, enNotaDebito: true },
  { codigo: "07", descripcion: "Sustituye comprobante electrónico", enNotaCredito: true, enNotaDebito: true },
  { codigo: "08", descripcion: "Factura endosada", enNotaCredito: true, enNotaDebito: true },
  { codigo: "09", descripcion: "Nota de crédito financiera", enNotaCredito: true, enNotaDebito: false },
  { codigo: "10", descripcion: "Nota de débito financiera", enNotaCredito: false, enNotaDebito: true },
  { codigo: "11", descripcion: "Proveedor no domiciliado", enNotaCredito: true, enNotaDebito: true },
  {
    codigo: "12",
    descripcion: "Nota de crédito financiera por exoneración posterior a la facturación",
    enNotaCredito: true,
    enNotaDebito: false,
  },
  { codigo: "13", descripcion: "Anula documento de referencia por error material", enNotaCredito: true, enNotaDebito: true },
  { codigo: "14", descripcion: "Corrige monto por error material", enNotaCredito: true, enNotaDebito: true },
  { codigo: "15", descripcion: "Sustituye comprobante electrónico por error material", enNotaCredito: false, enNotaDebito: false },
  { codigo: "16", descripcion: "Sustituye comprobante electrónico rechazado", enNotaCredito: false, enNotaDebito: false },
  { codigo: "17", descripcion: "Pago a comprobante electrónico", enNotaCredito: false, enNotaDebito: false },
  { codigo: "99", descripcion: "Otros", enNotaCredito: true, enNotaDebito: true },
];

export function codigosReferenciaParaNota(tipo: "credito" | "debito"): FeCodigoReferenciaMeta[] {
  return FE_CODIGOS_REFERENCIA.filter((row) => (tipo === "credito" ? row.enNotaCredito : row.enNotaDebito));
}

export function mensajeEfectoCodigoReferencia(codigo: string): string | null {
  if (codigo === "13" || codigo === "14") {
    return "El efecto contable va en el período del comprobante original, no en el mes de esta nota. Si ese período ya se declaró, puede hacer falta un ajuste.";
  }
  if (codigo === "12") {
    return "Solo para una exoneración de impuesto local aprobada después de facturar. El efecto queda en el período de esta nota.";
  }
  if (codigo === "01") {
    return "Si debe emitir un comprobante nuevo, ese documento referencia al anulado con el código 07. El efecto de esta nota queda en el período en que se emite.";
  }
  return null;
}

export function codigoReferenciaPermitidoEnNota(codigo: string, tipo: "credito" | "debito"): string | null {
  const row = FE_CODIGOS_REFERENCIA.find((item) => item.codigo === codigo);
  if (!row) return "Código de referencia no está en la nota 9 del anexo 4.4.";
  const permitido = tipo === "credito" ? row.enNotaCredito : row.enNotaDebito;
  if (!permitido) {
    return `El código ${codigo} (${row.descripcion}) no aplica a una nota de ${tipo === "credito" ? "crédito" : "débito"}.`;
  }
  return null;
}

/**
 * Nota 10 — tipo de documento de referencia (TipoDocIR).
 * 19 y 20 entran con la actualización de noviembre 2026.
 * En el recibo electrónico de pago solo se aceptan 01, 04, 07, 08, 10 y 20.
 */
export const FE_TIPO_DOC_IR_REP = ["01", "04", "07", "08", "10", "20"] as const;

export const FE_TIPOS_DOC_IR: Record<string, string> = {
  "01": "Factura electrónica",
  "02": "Nota de débito electrónica",
  "03": "Nota de crédito electrónica",
  "04": "Tiquete electrónico",
  "05": "Nota de despacho",
  "06": "Contrato",
  "07": "Procedimiento",
  "08": "Comprobante emitido en contingencia",
  "09": "Devolución mercadería",
  "10": "Comprobante electrónico rechazado por el Ministerio de Hacienda",
  "11": "Sustituye factura rechazada por el receptor del comprobante",
  "12": "Sustituye factura de exportación",
  "13": "Facturación mes vencido",
  "14": "Comprobante aportado por contribuyente de régimen especial",
  "15": "Sustituye una factura electrónica de compra",
  "16": "Comprobante de proveedor no domiciliado",
  "17": "Nota de crédito a factura electrónica de compra",
  "18": "Nota de débito a factura electrónica de compra",
  "19": "Factura electrónica de exportación",
  "20": "Recibo electrónico de pago",
  "99": "Otros",
};

export function tipoDocIrAlSustituir(codigo: string, tipoEmision: string | null | undefined): string {
  if (codigo === "16") return "10";
  if (tipoEmision === "FACTURA_ELECTRONICA_EXPORTACION") return "19";
  if (tipoEmision === "TIQUETE_ELECTRONICO") return "04";
  if (tipoEmision === "NOTA_DEBITO") return "02";
  if (tipoEmision === "NOTA_CREDITO") return "03";
  return "01";
}

export function tipoDocIrReciboDesdeComprobante(tipo: string | null | undefined): string | null {
  switch (tipo) {
    case "FACTURA_ELECTRONICA":
      return "01";
    case "TIQUETE_ELECTRONICO":
      return "04";
    case "FACTURA_ELECTRONICA_COMPRA":
      return "08";
    case "RECIBO_ELECTRONICO_PAGO":
      return "20";
    default:
      return null;
  }
}

export const HACIENDA_CLIENT_ID: Record<FeAmbiente, string> = {
  STAGING: "api-stag",
  PRODUCCION: "api-prod",
};

/** Mapeo respuesta Hacienda → estado interno */
export function mapHaciendaIndEstado(indEstado: string): {
  hacienda: "RECIBIDO" | "PROCESANDO" | "ACEPTADO" | "ACEPTADO_PARCIALMENTE" | "RECHAZADO" | "ERROR";
  factura: "ENVIADA" | "ACEPTADA" | "ACEPTADA_PARCIALMENTE" | "RECHAZADA" | "ERROR";
  terminal: boolean;
} {
  const key = indEstado.toLowerCase().replace(/[\s_-]/g, "");
  switch (key) {
    case "recibido":
      return { hacienda: "RECIBIDO", factura: "ENVIADA", terminal: false };
    case "procesando":
      return { hacienda: "PROCESANDO", factura: "ENVIADA", terminal: false };
    case "aceptado":
      return { hacienda: "ACEPTADO", factura: "ACEPTADA", terminal: true };
    case "aceptadoparcialmente":
    case "aceptadoparcial":
      return { hacienda: "ACEPTADO_PARCIALMENTE", factura: "ACEPTADA_PARCIALMENTE", terminal: true };
    case "rechazado":
      return { hacienda: "RECHAZADO", factura: "RECHAZADA", terminal: true };
    default:
      return { hacienda: "ERROR", factura: "ERROR", terminal: true };
  }
}
