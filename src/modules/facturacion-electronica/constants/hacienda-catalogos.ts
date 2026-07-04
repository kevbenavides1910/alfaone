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
