import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(8000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");

export const sigManagementReviewStatusSchema = z.enum([
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "FOLLOW_UP",
  "CLOSED",
]);

export const sigManagementReviewInputKeySchema = z.enum([
  "PRIOR_ACTIONS",
  "CONTEXT_CHANGES",
  "CUSTOMER_FEEDBACK",
  "QUALITY_OBJECTIVES",
  "PROCESS_PERFORMANCE",
  "NONCONFORMITIES_CAPA",
  "MONITORING_MEASUREMENT",
  "AUDIT_RESULTS",
  "EXTERNAL_PROVIDERS",
  "RESOURCES",
  "RISKS_OPPORTUNITIES_EFFICACY",
  "IMPROVEMENT_OPPORTUNITIES",
]);

export const sigManagementReviewActionStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const createManagementReviewSchema = z.object({
  title: z.string().trim().min(1).max(300),
  meetingDate: z.string().min(1),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable(),
  location: z.string().trim().max(300).optional().nullable(),
  attendees: optionalText,
  agenda: optionalText,
  minutesSummary: optionalText,
  outputImprovements: optionalText,
  outputQmsChanges: optionalText,
  outputResourceNeeds: optionalText,
  status: sigManagementReviewStatusSchema.optional(),
  chairUserId: z.string().optional().nullable(),
  previousReviewId: z.string().optional().nullable(),
  processIds: z.array(idSchema).optional(),
  evidenceIds: z.array(idSchema).optional(),
});

export const updateManagementReviewSchema = createManagementReviewSchema
  .partial()
  .omit({ processIds: true, evidenceIds: true })
  .extend({
    title: z.string().trim().min(1).max(300).optional(),
  });

export const updateManagementReviewInputSchema = z.object({
  inputKey: sigManagementReviewInputKeySchema,
  covered: z.boolean().optional(),
  notes: optionalText,
});

export const createManagementReviewActionSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalText,
  status: sigManagementReviewActionStatusSchema.optional(),
  dueDate: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  efficacyNotes: optionalText,
});

export const updateManagementReviewActionSchema = createManagementReviewActionSchema.partial().extend({
  title: z.string().trim().min(1).max(300).optional(),
});

export const linkManagementReviewSchema = z.object({
  processId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export type CreateManagementReviewInput = z.infer<typeof createManagementReviewSchema>;
export type UpdateManagementReviewInput = z.infer<typeof updateManagementReviewSchema>;
