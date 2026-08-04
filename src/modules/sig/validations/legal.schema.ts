import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");

export const sigLegalComplianceStatusSchema = z.enum([
  "COMPLIANT",
  "PARTIAL",
  "NON_COMPLIANT",
  "NOT_EVALUATED",
  "NOT_APPLICABLE",
]);

export const createLegalRequirementSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText,
  legalSource: z.string().trim().min(1).max(400),
  authority: z.string().trim().max(200).optional().nullable(),
  articleRef: z.string().trim().max(200).optional().nullable(),
  jurisdiction: z.string().trim().max(50).optional().nullable(),
  processId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  complianceStatus: sigLegalComplianceStatusSchema.optional(),
  evaluationNotes: optionalText,
  effectiveFrom: z.string().optional().nullable(),
  effectiveUntil: z.string().optional().nullable(),
  nextReviewDate: z.string().optional().nullable(),
  processIds: z.array(idSchema).optional(),
  documentIds: z.array(idSchema).optional(),
  controlIds: z.array(idSchema).optional(),
  evidenceIds: z.array(idSchema).optional(),
});

export const updateLegalRequirementSchema = createLegalRequirementSchema
  .partial()
  .omit({
    processIds: true,
    documentIds: true,
    controlIds: true,
    evidenceIds: true,
  });

export const linkLegalRequirementSchema = z.object({
  processId: z.string().optional(),
  documentId: z.string().optional(),
  controlId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export type CreateLegalRequirementInput = z.infer<typeof createLegalRequirementSchema>;
export type UpdateLegalRequirementInput = z.infer<typeof updateLegalRequirementSchema>;
