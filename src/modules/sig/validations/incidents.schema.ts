import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");

export const sigIncidentTypeSchema = z.enum([
  "SECURITY_EVENT",
  "USE_OF_FORCE",
  "HUMAN_RIGHTS",
  "COMPLAINT",
  "NEAR_MISS",
  "OTHER",
]);
export const sigIncidentSeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const sigIncidentStatusSchema = z.enum([
  "REPORTED",
  "UNDER_INVESTIGATION",
  "ACTIONS_PENDING",
  "CLOSED",
  "DISMISSED",
]);

export const createIncidentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(8000),
  type: sigIncidentTypeSchema.optional(),
  severity: sigIncidentSeveritySchema.optional(),
  status: sigIncidentStatusSchema.optional(),
  occurredAt: z.string().min(1),
  reportedAt: z.string().optional().nullable(),
  location: z.string().trim().max(300).optional().nullable(),
  processId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  involvedParties: optionalText,
  immediateActions: optionalText,
  rootCause: optionalText,
  correctiveActions: optionalText,
  humanRightsImpact: z.boolean().optional(),
  notificationRequired: z.boolean().optional(),
  notifiedAt: z.string().optional().nullable(),
  closureNotes: optionalText,
  processIds: z.array(idSchema).optional(),
  controlIds: z.array(idSchema).optional(),
  evidenceIds: z.array(idSchema).optional(),
});

export const updateIncidentSchema = createIncidentSchema
  .partial()
  .omit({ processIds: true, controlIds: true, evidenceIds: true })
  .extend({
    description: z.string().trim().min(1).max(8000).optional(),
  });

export const linkIncidentSchema = z.object({
  processId: z.string().optional(),
  controlId: z.string().optional(),
  evidenceId: z.string().optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
