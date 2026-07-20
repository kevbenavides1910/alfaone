/**
 * Clasificación de formas de pago para Revisión de planilla,
 * alineada con el Excel «Revisión Planilla» (CK / DAV / BN) y RPL3073.
 *
 * Fuente correcta: NAF5.ARPLME.FORMA_PAGO (K=cheque, T=transferencia).
 * Banco vía VDATOS_EMPLEADO.BANCO; si falta, ARPLME.ID_CTA (01≈BN, 07≈Davivienda).
 */

export type FormaPagoCanal = "CK" | "DAV" | "BN" | "OTRO";

export function classifyFormaPagoCanal(
  formaPago: string | null | undefined,
  banco: string | null | undefined,
  idCta?: string | null | undefined,
): FormaPagoCanal {
  const fp = (formaPago ?? "").trim().toUpperCase();
  if (fp === "K") return "CK";

  const bank = (banco ?? "").trim().toUpperCase();
  if (bank.includes("DAVIVIENDA")) return "DAV";
  if (bank.includes("NACIONAL")) return "BN";

  const cta = (idCta ?? "").trim();
  if (cta === "07") return "DAV";
  if (cta === "01") return "BN";

  return "OTRO";
}
