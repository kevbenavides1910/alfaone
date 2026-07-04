export const NAF_TIPO_DOC_LABELS: Record<string, string> = {
  FC: "Factura",
  NC: "Nota de crédito",
  ND: "Nota de débito",
  RP: "Recibo de pago",
  RE: "Recibo",
  AN: "Anulación",
  NT: "Nota",
};

export const NAF_ESTADO_LABELS: Record<string, string> = {
  D: "Digitado",
  M: "Mayorizado",
};

export const NAF_ESTADO_TRIBUTACION_LABELS: Record<string, string> = {
  I: "Enviado Hacienda",
  A: "Aceptado",
  R: "Rechazado",
};

export function labelTipoDoc(code: string | null | undefined): string {
  if (!code) return "—";
  return NAF_TIPO_DOC_LABELS[code] ?? code;
}

export function labelEstado(code: string | null | undefined): string {
  if (!code) return "—";
  return NAF_ESTADO_LABELS[code] ?? code;
}

export function labelEstadoTributacion(code: string | null | undefined): string {
  if (!code) return "—";
  return NAF_ESTADO_TRIBUTACION_LABELS[code] ?? code;
}
