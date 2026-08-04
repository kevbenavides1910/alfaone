import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");
const isoDateSchema = z.string().min(1, "Fecha requerida");

export const auditStatusSchema = z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
export const findingSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const findingStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]);
export const findingTypeSchema = z.enum(["NONCONFORMITY", "OBSERVATION", "OPPORTUNITY"]);
export const actionPlanStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
export const actionPlanEfficacyStatusSchema = z.enum(["PENDING", "VERIFIED", "NOT_EFFECTIVE"]);
export const auditChecklistResultSchema = z.enum(["PENDING", "COMPLIES", "NON_COMPLIES", "NOT_APPLICABLE"]);
export const auditSampleMethodSchema = z.enum(["RANDOM", "RISK_BASED", "AUDITOR_JUDGMENT", "MIXED"]);

export const createAuditSchema = z.object({
  procedureId: idSchema,
  scheduledDate: isoDateSchema,
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  status: auditStatusSchema.optional(),
  scope: optionalText,
  objective: optionalText,
  notes: optionalText,
  auditorId: z.string().optional().nullable(),
});

export const updateAuditSchema = createAuditSchema
  .omit({ procedureId: true, year: true, quarter: true })
  .partial();

export const createChecklistItemSchema = z.object({
  stage: z.string().trim().min(1, "Etapa requerida").max(200),
  requirement: optionalText,
  requirementId: z.string().optional().nullable(),
  result: auditChecklistResultSchema.optional(),
  notes: optionalText,
  evidence: optionalText,
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const updateChecklistItemSchema = createChecklistItemSchema.partial();

export const createFindingSchema = z.object({
  title: z.string().trim().min(1, "Título requerido").max(200),
  description: z.string().trim().min(1, "Descripción requerida").max(4000),
  findingType: findingTypeSchema.optional(),
  severity: findingSeveritySchema.optional(),
  status: findingStatusSchema.optional(),
  criterionText: optionalText,
  evidenceStatement: optionalText,
  nonconformityStatement: optionalText,
  rootCause: optionalText,
  checklistItemId: z.string().optional().nullable(),
  requirementIds: z.array(idSchema).optional(),
});

export const updateFindingSchema = createFindingSchema.partial();

export const createActionPlanSchema = z.object({
  title: z.string().trim().min(1, "Título requerido").max(200),
  description: z.string().trim().min(1, "Descripción requerida").max(4000),
  correctionImmediate: optionalText,
  responsibleName: z.string().trim().max(200).optional().nullable(),
  responsibleUserId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  status: actionPlanStatusSchema.optional(),
});

export const updateActionPlanSchema = createActionPlanSchema
  .partial()
  .extend({
    efficacyStatus: actionPlanEfficacyStatusSchema.optional(),
    efficacyNotes: optionalText,
  });

export const verifyEfficacySchema = z.object({
  efficacyStatus: z.enum(["VERIFIED", "NOT_EFFECTIVE"]),
  efficacyNotes: optionalText,
});

export const createFollowUpSchema = z.object({
  note: z.string().trim().min(1, "Nota requerida").max(4000),
  status: actionPlanStatusSchema,
  followUpDate: z.string().optional().nullable(),
});

export const updateFollowUpSchema = createFollowUpSchema.partial();

export const createSampleSchema = z.object({
  populationDescription: z.string().trim().min(1).max(4000),
  populationSize: z.coerce.number().int().min(0).optional().nullable(),
  sampleSize: z.coerce.number().int().min(0).optional().nullable(),
  method: auditSampleMethodSchema.optional(),
  notes: optionalText,
  items: z
    .array(
      z.object({
        code: z.string().trim().max(100).optional().nullable(),
        label: z.string().trim().min(1).max(300),
        notes: optionalText,
      })
    )
    .optional(),
});

export const updateSampleSchema = createSampleSchema.partial();

export type CreateAuditInput = z.infer<typeof createAuditSchema>;
export type UpdateAuditInput = z.infer<typeof updateAuditSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type CreateFindingInput = z.infer<typeof createFindingSchema>;
export type UpdateFindingInput = z.infer<typeof updateFindingSchema>;
export type CreateActionPlanInput = z.infer<typeof createActionPlanSchema>;
export type UpdateActionPlanInput = z.infer<typeof updateActionPlanSchema>;
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
export type CreateSampleInput = z.infer<typeof createSampleSchema>;
export type UpdateSampleInput = z.infer<typeof updateSampleSchema>;
