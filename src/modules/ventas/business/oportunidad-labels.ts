import type { VentasOportunidadEstado } from "../validations/oportunidad.schema";

export const VENTAS_OPORTUNIDAD_ESTADO_LABELS: Record<VentasOportunidadEstado, string> = {
  PENDIENTE_DECIDIR: "Pendiente de decidir",
  PARTICIPAR: "Participar",
  NO_PARTICIPAR: "No participar",
};

export const VENTAS_OPORTUNIDAD_ESTADO_OPTIONS = (
  Object.entries(VENTAS_OPORTUNIDAD_ESTADO_LABELS) as [VentasOportunidadEstado, string][]
).map(([value, label]) => ({ value, label }));
