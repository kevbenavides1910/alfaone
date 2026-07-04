/** Agrupación de estados para exportación de reportes. */
export const TICKET_EXPORT_STATUS_GROUPS = {
  ABIERTO: {
    label: "Abierto",
    codes: ["NUEVO", "ASIGNADO", "REABIERTO"],
  },
  PROCESO: {
    label: "Proceso",
    codes: [
      "EN_PROCESO",
      "ESPERANDO_INFORMACION",
      "ESPERANDO_PROVEEDOR",
      "VERIFICACION_USUARIO",
      "RESUELTO",
    ],
  },
  CERRADO: {
    label: "Cerrado",
    codes: ["CERRADO", "CANCELADO", "RECHAZADO"],
  },
} as const;

export type TicketExportStatusGroupKey = keyof typeof TICKET_EXPORT_STATUS_GROUPS;

export function statusCodesForExportGroups(groups: TicketExportStatusGroupKey[]): string[] {
  const codes = new Set<string>();
  for (const g of groups) {
    for (const code of TICKET_EXPORT_STATUS_GROUPS[g].codes) {
      codes.add(code);
    }
  }
  return [...codes];
}
