export const HR_TRAMITES = {
  CARTA_FCL: "CARTA_FCL",
  CARTA_SERVICIO: "CARTA_SERVICIO",
} as const;

export type HrTramite = (typeof HR_TRAMITES)[keyof typeof HR_TRAMITES];

export const HR_TRAMITE_LABELS: Record<HrTramite, string> = {
  CARTA_FCL: "Carta de retiro FCL (Fondo de Capitalización Laboral)",
  CARTA_SERVICIO: "Carta de servicio (tiempo laborado)",
};

export function isHrTramite(value: unknown): value is HrTramite {
  return value === HR_TRAMITES.CARTA_FCL || value === HR_TRAMITES.CARTA_SERVICIO;
}
