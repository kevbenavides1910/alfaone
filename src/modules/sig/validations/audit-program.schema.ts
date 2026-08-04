import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(4000)
  .optional()
  .nullable()
  .transform((value) => (value ? value : null));

const idSchema = z.string().min(1, "Identificador requerido");

export const auditProgramStatusSchema = z.enum(["DRAFT", "APPROVED", "IN_PROGRESS", "CLOSED"]);
export const auditProgramPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const auditProgramItemStatusSchema = z.enum([
  "PLANNED",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "DEFERRED",
]);

export const createAuditProgramSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  title: z.string().trim().min(1).max(300).optional(),
  notes: optionalText,
  seedFromProcedures: z.boolean().optional().default(true),
});

export const updateAuditProgramSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  notes: optionalText,
  status: auditProgramStatusSchema.optional(),
});

export const createAuditProgramItemSchema = z.object({
  processId: z.string().optional().nullable(),
  procedureId: z.string().optional().nullable(),
  plannedMonth: z.coerce.number().int().min(1).max(12),
  priority: auditProgramPrioritySchema.optional(),
  priorityScore: z.coerce.number().int().min(0).max(200).optional(),
  priorityReason: optionalText,
  scope: optionalText,
  objective: optionalText,
  notes: optionalText,
  auditorId: z.string().optional().nullable(),
  status: auditProgramItemStatusSchema.optional(),
});

export const updateAuditProgramItemSchema = createAuditProgramItemSchema.partial().extend({
  plannedMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export const createAuditFromProgramItemSchema = z.object({
  scheduledDate: z.string().min(1).optional(),
  auditorId: z.string().optional().nullable(),
});

export type CreateAuditProgramInput = z.infer<typeof createAuditProgramSchema>;
export type UpdateAuditProgramInput = z.infer<typeof updateAuditProgramSchema>;
export type CreateAuditProgramItemInput = z.infer<typeof createAuditProgramItemSchema>;
export type UpdateAuditProgramItemInput = z.infer<typeof updateAuditProgramItemSchema>;
