import { z } from "zod";

export const cuentasPorCobrarListSchema = z.object({
  filter: z.enum(["pending", "collected", "all"]).default("pending"),
  company: z.string().trim().optional(),
});

export const confirmPaymentSchema = z.object({
  received: z.boolean(),
});

export const updateCxcObservationsSchema = z.object({
  cxcObservations: z.string().max(8000).nullable(),
});

export type CuentasPorCobrarListInput = z.infer<typeof cuentasPorCobrarListSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type UpdateCxcObservationsInput = z.infer<typeof updateCxcObservationsSchema>;
