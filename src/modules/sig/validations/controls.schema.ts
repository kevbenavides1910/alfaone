import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");

export const sigControlStatusSchema = z.enum(["ACTIVE", "INACTIVE", "UNDER_REVIEW"]);

export const createControlSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText,
  status: sigControlStatusSchema.optional(),
  processId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  evidenceIntervalDays: z.coerce.number().int().min(1).max(3650).optional().nullable(),
  requirementIds: z.array(idSchema).optional(),
  processIds: z.array(idSchema).optional(),
  documentIds: z.array(idSchema).optional(),
});

export const updateControlSchema = createControlSchema.partial().omit({
  requirementIds: true,
  processIds: true,
  documentIds: true,
});

export const linkControlSchema = z.object({
  requirementId: z.string().optional(),
  processId: z.string().optional(),
  documentId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export type CreateControlInput = z.infer<typeof createControlSchema>;
export type UpdateControlInput = z.infer<typeof updateControlSchema>;
