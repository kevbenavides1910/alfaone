import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");
const scaleSchema = z.coerce.number().int().min(1).max(5);

export const sigRiskKindSchema = z.enum(["RISK", "OPPORTUNITY"]);
export const sigRiskStatusSchema = z.enum([
  "IDENTIFIED",
  "ANALYZED",
  "TREATING",
  "MONITORING",
  "CLOSED",
]);

export const createRiskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText,
  kind: sigRiskKindSchema.optional(),
  status: sigRiskStatusSchema.optional(),
  processId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  likelihood: scaleSchema.optional(),
  impact: scaleSchema.optional(),
  residualLikelihood: scaleSchema.optional().nullable(),
  residualImpact: scaleSchema.optional().nullable(),
  treatment: optionalText,
  reviewDate: z.string().optional().nullable(),
  nextReviewDate: z.string().optional().nullable(),
  processIds: z.array(idSchema).optional(),
  controlIds: z.array(idSchema).optional(),
  requirementIds: z.array(idSchema).optional(),
  evidenceIds: z.array(idSchema).optional(),
});

export const updateRiskSchema = createRiskSchema
  .partial()
  .omit({
    processIds: true,
    controlIds: true,
    requirementIds: true,
    evidenceIds: true,
  });

export const linkRiskSchema = z.object({
  processId: z.string().optional(),
  controlId: z.string().optional(),
  requirementId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;
