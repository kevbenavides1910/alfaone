export type CxpEstadoPago =
  | "PENDIENTE"
  | "PARCIAL"
  | "PAGADA"
  | "ANULADA"
  | "SIN_CXP";

export type CxpEstadoFilter = "ALL" | CxpEstadoPago;

export type CxpFaeLinkFilter = "ALL" | "CON_FAE" | "SIN_FAE" | "FAE_PENDIENTE";

export type CxpFaeAceptacion = "A" | "AA" | "P" | "R" | "X" | string;

export function resolveCxpEstado(input: {
  anulado: string | null | undefined;
  saldo: number;
  nAplicaciones: number;
  sinCxp?: boolean;
}): CxpEstadoPago {
  if (input.sinCxp) return "SIN_CXP";
  const anulado = (input.anulado ?? "N").trim().toUpperCase();
  if (anulado === "S") return "ANULADA";
  if (input.saldo > 0 && input.nAplicaciones > 0) return "PARCIAL";
  if (input.saldo > 0) return "PENDIENTE";
  return "PAGADA";
}

export function labelCxpEstado(estado: CxpEstadoPago): string {
  switch (estado) {
    case "PENDIENTE":
      return "Pendiente pago";
    case "PARCIAL":
      return "Parcial";
    case "PAGADA":
      return "Pagada";
    case "ANULADA":
      return "Anulada";
    case "SIN_CXP":
      return "Sin CXP (solo FAE)";
  }
}

export function labelFaeAceptacion(code: string | null | undefined): string {
  const c = (code ?? "").trim().toUpperCase();
  switch (c) {
    case "A":
      return "Aceptada";
    case "AA":
      return "Aceptación automática";
    case "P":
      return "Pendiente aceptación";
    case "R":
      return "Rechazada";
    case "X":
      return "Rechazo parcial";
    case "":
      return "—";
    default:
      return c;
  }
}

export function labelMonedaCxp(moneda: string | null | undefined): string {
  const m = (moneda ?? "").trim().toUpperCase();
  if (m === "P" || m === "CRC" || m === "¢") return "CRC";
  if (m === "D" || m === "USD" || m === "$") return "USD";
  return m || "—";
}
