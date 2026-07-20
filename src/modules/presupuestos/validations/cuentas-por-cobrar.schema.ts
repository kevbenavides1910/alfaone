import { z } from "zod";

const optionalDateQuery = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .or(z.literal(""));

export const cuentasPorCobrarListSchema = z.object({
  filter: z.enum(["pending", "collected", "all"]).default("pending"),
  company: z.string().trim().optional(),
  companies: z.array(z.string().trim().min(1)).optional(),
  client: z.string().trim().optional(),
  licitacion: z.string().trim().optional(),
  issuedFrom: optionalDateQuery,
  issuedTo: optionalDateQuery,
  expectedPaymentFrom: optionalDateQuery,
  expectedPaymentTo: optionalDateQuery,
  receivedFrom: optionalDateQuery,
  receivedTo: optionalDateQuery,
});

export const confirmPaymentSchema = z.object({
  received: z.boolean(),
});

export const updateCxcObservationsSchema = z.object({
  cxcObservations: z.string().max(8000).nullable(),
});

const optionalCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
  .optional()
  .nullable()
  .transform((v) => (v === "" ? null : v));

export const updateCxcGestionSchema = z.object({
  isReajuste: z.boolean().optional(),
  invoiceReceivedAt: optionalCalendarDate,
  cxcExpectedPaymentDate: optionalCalendarDate,
  provisionalReceiptNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  provisionalPaymentAmount: z.coerce
    .number()
    .min(0, "El abono no puede ser negativo")
    .optional()
    .nullable()
    .transform((v) => (v === 0 ? null : v)),
});

export const cxcAbonoBodySchema = z.object({
  receiptNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  paidAt: optionalCalendarDate,
});

export const cxcAbonoUpdateSchema = cxcAbonoBodySchema.partial();

export const cxcRebajoBodySchema = z.object({
  description: z.string().trim().min(1, "Descripción requerida").max(500),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
});

export const cxcRebajoUpdateSchema = cxcRebajoBodySchema.partial();

export type CuentasPorCobrarListInput = z.infer<typeof cuentasPorCobrarListSchema>;
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
export type UpdateCxcObservationsInput = z.infer<typeof updateCxcObservationsSchema>;
export type UpdateCxcGestionInput = z.infer<typeof updateCxcGestionSchema>;
export type CxcAbonoBodyInput = z.infer<typeof cxcAbonoBodySchema>;
export type CxcRebajoBodyInput = z.infer<typeof cxcRebajoBodySchema>;
