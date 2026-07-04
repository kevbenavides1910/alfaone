import { z } from "zod";

export const facturacionPeriodSchema = z.object({
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
});

export const facturaMensualUpdateSchema = z.object({
  observationLog: z.string().max(10000).optional(),
  finalNotes: z.string().max(5000).optional(),
  invoiceNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),
});

export const cerrarFacturacionSchema = z.object({
  finalNotes: z.string().max(5000).optional(),
});

export type FacturacionPeriodInput = z.infer<typeof facturacionPeriodSchema>;
export type FacturaMensualUpdateInput = z.infer<typeof facturaMensualUpdateSchema>;
export type CerrarFacturacionInput = z.infer<typeof cerrarFacturacionSchema>;
