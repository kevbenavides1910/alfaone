import { z } from "zod";
import {
  CALENDARIO_COLOR_KEYS,
  CALENDARIO_EVENT_STATUSES,
  CALENDARIO_RECURRENCES,
} from "@/modules/naf-operaciones/business/calendario-types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

export const calendarioListQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  zoneId: z.string().min(1).optional(),
  contractId: z.string().min(1).optional(),
  typeId: z.string().min(1).optional(),
  /** Eventos donde alguno de estos usuarios es administrador. */
  adminUserIds: z.array(z.string().min(1)).max(50).optional(),
  status: z.enum(CALENDARIO_EVENT_STATUSES).optional(),
});
export type CalendarioListQuery = z.infer<typeof calendarioListQuerySchema>;

const eventBase = z.object({
  date: isoDate,
  title: z.string().trim().min(1, "Título requerido").max(200),
  typeId: z.string().min(1, "Tipo requerido"),
  status: z.enum(CALENDARIO_EVENT_STATUSES).optional(),
  description: z.string().trim().max(5000).nullish(),
  zoneId: z.string().min(1).nullish(),
  /** Aplica a todos los contratos vigentes (de la zona si se indica); ignora `contractIds`. */
  allContracts: z.boolean().optional(),
  contractIds: z.array(z.string().min(1)).max(2000).optional(),
  adminUserIds: z.array(z.string().min(1)).max(50).optional(),
  /** Una vez, o repetir la misma tarea cada mes, 3 meses, 6 meses o un año. */
  recurrence: z.enum(CALENDARIO_RECURRENCES).optional(),
});

export const calendarioCreateSchema = eventBase.refine(
  (v) => v.allContracts || (v.contractIds?.length ?? 0) > 0,
  { message: "Seleccione al menos un contrato", path: ["contractIds"] },
);
export type CalendarioCreateInput = z.infer<typeof calendarioCreateSchema>;

export const calendarioUpdateSchema = eventBase.partial();
export type CalendarioUpdateInput = z.infer<typeof calendarioUpdateSchema>;

export const calendarioCompletionSchema = z.object({
  /** Vacío = todos los contratos del evento. */
  contractIds: z.array(z.string().min(1)).max(2000).optional(),
  completed: z.boolean(),
});
export type CalendarioCompletionInput = z.infer<typeof calendarioCompletionSchema>;

export const calendarioStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "DONE"]),
});
export type CalendarioStatusInput = z.infer<typeof calendarioStatusSchema>;

export const calendarioTipoCreateSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(100),
  color: z.enum(CALENDARIO_COLOR_KEYS).default("gray"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type CalendarioTipoCreateInput = z.infer<typeof calendarioTipoCreateSchema>;

export const calendarioTipoPatchSchema = calendarioTipoCreateSchema.partial();
export type CalendarioTipoPatchInput = z.infer<typeof calendarioTipoPatchSchema>;
