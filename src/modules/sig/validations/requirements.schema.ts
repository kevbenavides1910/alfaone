import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(8000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");

export const createRequirementSchema = z.object({
  standardId: idSchema,
  code: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(300),
  description: optionalText,
  observations: optionalText,
  parentId: z.string().optional().nullable(),
  isApplicable: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  lastReviewedAt: z.string().datetime().optional().nullable(),
});

export const updateRequirementSchema = createRequirementSchema
  .partial()
  .omit({ standardId: true })
  .extend({
    touchReviewed: z.boolean().optional(),
  });

export const linkRequirementProcessSchema = z.object({
  processId: idSchema,
});

export const linkRequirementDocumentSchema = z.object({
  documentId: idSchema,
});

export const linkRequirementEvidenceSchema = z.object({
  evidenceId: idSchema,
});

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
