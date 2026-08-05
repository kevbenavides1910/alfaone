/** Clase de documento en NAF5.ARCPTD.DOCUMENTO. */
export const CXP_DOCUMENTO_CLASE_LABELS: Record<string, string> = {
  F: "Factura / documento",
  K: "Pago (cheque / transferencia)",
  O: "Otro movimiento",
  A: "Ajuste",
};

export function labelCxpDocumentoClase(code: string | null | undefined): string {
  const c = (code ?? "").trim().toUpperCase();
  if (!c) return "—";
  return CXP_DOCUMENTO_CLASE_LABELS[c] ?? c;
}

/** Etiquetas conocidas de tipos CXP (fallback si Oracle no trae descripción). */
export const CXP_TIPO_DOC_LABELS: Record<string, string> = {
  FA: "Facturación local",
  FS: "Facturas de servicios",
  FH: "Facturas de honorarios",
  FP: "Factura psicológicos",
  FD: "Factura dictamen médico",
  FB: "Factura de bienes",
  NC: "Notas de crédito",
  ND: "Notas de débito",
  AN: "Anulación débito",
  NA: "Anulación de crédito",
  TR: "Transferencias",
  CK: "Cheques",
  GO: "Liq. gastos operativos",
  LQ: "Liquidaciones laborales",
  FV: "Facturas de vacaciones",
  GL: "Gasto legal",
  A1: "Ajuste débito",
  A2: "Ajuste crédito",
  AC: "Ajuste al crédito",
  AD: "Ajuste de débito",
  AA: "Adelanto a proveedores",
  EP: "Embargos y pensiones",
  DG: "Depósito de garantía",
  CC: "Cuentas por cobrar empleados",
  LP: "Liquidaciones parciales",
  AL: "Anulación liquidaciones",
};

export function labelCxpTipoDoc(
  code: string | null | undefined,
  desc?: string | null,
): string {
  const c = (code ?? "").trim().toUpperCase();
  if (!c) return "—";
  const fromOracle = (desc ?? "").trim();
  if (fromOracle) return `${fromOracle} (${c})`;
  const known = CXP_TIPO_DOC_LABELS[c];
  return known ? `${known} (${c})` : c;
}
