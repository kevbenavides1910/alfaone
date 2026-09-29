import { z } from "zod";
import {
  CALENDARIO_EVENT_STATUSES,
  CALENDARIO_EVENT_TYPES,
} from "@/modules/naf-operaciones/business/calendario-types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

export const calendarioListQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  zoneId: z.string().min(1).optional(),
  contractId: z.string().min(1).optional(),
  type: z.enum(CALENDARIO_EVENT_TYPES).optional(),
});
export type CalendarioListQuery = z.infer<typeof calendarioListQuerySchema>;

const eventBase = z.object({
  date: isoDate,
  title: z.string().trim().min(1, "Título requerido").max(200),
  type: z.enum(CALENDARIO_EVENT_TYPES),
  status: z.enum(CALENDARIO_EVENT_STATUSES).optional(),
  description: z.string().trim().max(5000).nullish(),
  zoneId: z.string().min(1).nullish(),
  /** Aplica a todos los contratos vigentes (de la zona si se indica); ignora `contractIds`. */
  allContracts: z.boolean().optional(),
  contractIds: z.array(z.string().min(1)).max(2000).optional(),
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
