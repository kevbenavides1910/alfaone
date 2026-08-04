import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");
const decimalSchema = z.coerce.number().finite();

export const sigIndicatorDirectionSchema = z.enum(["HIGHER_BETTER", "LOWER_BETTER"]);
export const sigIndicatorFrequencySchema = z.enum([
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "ADHOC",
]);
export const sigIndicatorStatusSchema = z.enum(["ACTIVE", "INACTIVE", "UNDER_REVIEW"]);

export const createIndicatorSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText,
  processId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  unit: z.string().trim().max(40).optional().nullable(),
  direction: sigIndicatorDirectionSchema.optional(),
  frequency: sigIndicatorFrequencySchema.optional(),
  targetValue: decimalSchema.optional().nullable(),
  warningThreshold: decimalSchema.optional().nullable(),
  criticalThreshold: decimalSchema.optional().nullable(),
  status: sigIndicatorStatusSchema.optional(),
  formulaNotes: optionalText,
  processIds: z.array(idSchema).optional(),
});

export const updateIndicatorSchema = createIndicatorSchema.partial().omit({ processIds: true });

export const createMeasurementSchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().optional().nullable(),
  value: decimalSchema,
  notes: optionalText,
  evidenceId: z.string().optional().nullable(),
});

export type CreateIndicatorInput = z.infer<typeof createIndicatorSchema>;
export type UpdateIndicatorInput = z.infer<typeof updateIndicatorSchema>;
export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;
