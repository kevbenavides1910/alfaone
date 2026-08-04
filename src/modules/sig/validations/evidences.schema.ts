import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");

export const sigEvidenceTypeSchema = z.enum([
  "PHOTO",
  "PDF",
  "EXCEL",
  "RECORD",
  "EMAIL",
  "ACTA",
  "CERTIFICATE",
  "INTERVIEW",
  "SCREENSHOT",
  "VIDEO",
  "FORM",
  "INSPECTION",
  "OTHER",
]);

export const sigEvidenceStatusSchema = z.enum(["ACTIVE", "EXPIRED", "SUPERSEDED"]);
export const sigEvidenceLinkRoleSchema = z.enum(["OBSERVED", "IMPLEMENTATION", "EFFICACY"]);

export const createEvidenceSchema = z.object({
  type: sigEvidenceTypeSchema.optional(),
  description: z.string().trim().min(1).max(4000),
  evidenceDate: z.string().min(1),
  validUntil: z.string().optional().nullable(),
  status: sigEvidenceStatusSchema.optional(),
  processId: z.string().optional().nullable(),
  requirementIds: z.array(idSchema).optional(),
  auditId: z.string().optional().nullable(),
  checklistItemId: z.string().optional().nullable(),
  findingId: z.string().optional().nullable(),
  actionPlanId: z.string().optional().nullable(),
  actionPlanRole: sigEvidenceLinkRoleSchema.optional(),
});

export const updateEvidenceSchema = z.object({
  type: sigEvidenceTypeSchema.optional(),
  description: z.string().trim().min(1).max(4000).optional(),
  evidenceDate: z.string().optional(),
  validUntil: z.string().optional().nullable(),
  status: sigEvidenceStatusSchema.optional(),
  processId: z.string().optional().nullable(),
});

export const linkEvidenceSchema = z.object({
  requirementId: z.string().optional(),
  auditId: z.string().optional(),
  checklistItemId: z.string().optional(),
  findingId: z.string().optional(),
  actionPlanId: z.string().optional(),
  actionPlanRole: sigEvidenceLinkRoleSchema.optional(),
});

export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;
export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>;
