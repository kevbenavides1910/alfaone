export type CxpEstadoPago = "PENDIENTE" | "PARCIAL" | "PAGADA" | "ANULADA";

export type CxpEstadoFilter = "ALL" | CxpEstadoPago;

export function resolveCxpEstado(input: {
  anulado: string | null | undefined;
  saldo: number;
  nAplicaciones: number;
}): CxpEstadoPago {
  const anulado = (input.anulado ?? "N").trim().toUpperCase();
  if (anulado === "S") return "ANULADA";
  if (input.saldo > 0 && input.nAplicaciones > 0) return "PARCIAL";
  if (input.saldo > 0) return "PENDIENTE";
  return "PAGADA";
}

export function labelCxpEstado(estado: CxpEstadoPago): string {
  switch (estado) {
    case "PENDIENTE":
      return "Pendiente";
    case "PARCIAL":
      return "Parcial";
    case "PAGADA":
      return "Pagada";
    case "ANULADA":
      return "Anulada";
  }
}

export function labelMonedaCxp(moneda: string | null | undefined): string {
  const m = (moneda ?? "").trim().toUpperCase();
  if (m === "P" || m === "CRC" || m === "¢") return "CRC";
  if (m === "D" || m === "USD" || m === "$") return "USD";
  return m || "—";
}
