import { z } from "zod";

export const facturacionPeriodSchema = z.object({
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
});

const optionalDateQuery = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""));

export const facturacionListSchema = facturacionPeriodSchema.extend({
  company: z.string().trim().optional(),
  status: z.string().trim().optional(),
  client: z.string().trim().optional(),
  licitacion: z.string().trim().optional(),
  expectedFrom: optionalDateQuery,
  expectedTo: optionalDateQuery,
  issuedFrom: optionalDateQuery,
  issuedTo: optionalDateQuery,
  receivedFrom: optionalDateQuery,
  receivedTo: optionalDateQuery,
});

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));

const optionalCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v));

export const facturaMensualUpdateSchema = z.object({
  observationLog: z.string().max(10000).optional(),
  finalNotes: z.string().max(5000).optional(),
  isReajuste: z.boolean().optional(),
  /** Administración activa: número, recibido y vencimiento no se copian a las demás. */
  emisionId: z.string().trim().min(1).optional(),
  invoiceNumber: optionalTrimmedString(100),
  servicePeriodFromDate: optionalCalendarDate,
  servicePeriodToDate: optionalCalendarDate,
  invoiceReceivedAt: optionalCalendarDate,
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
    .optional(),
});

export const cerrarFacturacionSchema = z.object({
  finalNotes: z.string().max(5000).optional(),
  isReajuste: z.boolean().optional().default(false),
  emisionId: z.string().trim().min(1).optional(),
});

export const facturaDocumentationReturnSchema = z.object({
  reason: z.string().trim().max(4000).optional(),
});

export const facturaAmountReturnRequestSchema = z.object({
  reason: z.string().trim().min(3).max(4000),
  requestedSubtotal: z.coerce.number().positive().max(999_999_999_999.99),
});

export const facturaReturnReviewSchema = z.object({
  reviewNote: z.string().trim().max(4000).optional().nullable(),
});

export type FacturacionPeriodInput = z.infer<typeof facturacionPeriodSchema>;
export type FacturacionListInput = z.infer<typeof facturacionListSchema>;
export type FacturaMensualUpdateInput = z.infer<typeof facturaMensualUpdateSchema>;
export type CerrarFacturacionInput = z.infer<typeof cerrarFacturacionSchema>;
