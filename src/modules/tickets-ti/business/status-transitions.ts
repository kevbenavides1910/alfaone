/**
 * Códigos de estado del ticket (catálogo ticket_statuses.code).
 * Deben coincidir con el seed en prisma/seed-tickets-ti-catalogs.mjs
 */
export const TICKET_STATUS_CODE = {
  NUEVO: "NUEVO",
  ASIGNADO: "ASIGNADO",
  EN_PROCESO: "EN_PROCESO",
  ESPERANDO_INFORMACION: "ESPERANDO_INFORMACION",
  ESPERANDO_PROVEEDOR: "ESPERANDO_PROVEEDOR",
  RESUELTO: "RESUELTO",
  VERIFICACION_USUARIO: "VERIFICACION_USUARIO",
  CERRADO: "CERRADO",
  REABIERTO: "REABIERTO",
  CANCELADO: "CANCELADO",
  RECHAZADO: "RECHAZADO",
} as const;

export type TicketStatusCode = (typeof TICKET_STATUS_CODE)[keyof typeof TICKET_STATUS_CODE];

/** Transiciones permitidas (from → to[]). Spec §12 máquina de estados. */
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatusCode, TicketStatusCode[]> = {
  NUEVO: ["ASIGNADO", "CANCELADO", "RECHAZADO"],
  ASIGNADO: ["EN_PROCESO", "ESPERANDO_INFORMACION", "CANCELADO"],
  EN_PROCESO: [
    "ESPERANDO_INFORMACION",
    "ESPERANDO_PROVEEDOR",
    "RESUELTO",
    "CANCELADO",
  ],
  ESPERANDO_INFORMACION: ["EN_PROCESO", "CANCELADO"],
  ESPERANDO_PROVEEDOR: ["EN_PROCESO", "CANCELADO"],
  RESUELTO: ["VERIFICACION_USUARIO", "CERRADO", "EN_PROCESO"],
  VERIFICACION_USUARIO: ["CERRADO", "REABIERTO"],
  CERRADO: ["REABIERTO"],
  REABIERTO: ["ASIGNADO", "EN_PROCESO", "CANCELADO"],
  CANCELADO: [],
  RECHAZADO: [],
};

export function canTransitionTicketStatus(
  from: TicketStatusCode,
  to: TicketStatusCode
): boolean {
  if (from === to) return true;
  return TICKET_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTicketStatusTransition(
  from: TicketStatusCode,
  to: TicketStatusCode
): void {
  if (!canTransitionTicketStatus(from, to)) {
    throw new Error(`Transición de estado no permitida: ${from} → ${to}`);
  }
}
