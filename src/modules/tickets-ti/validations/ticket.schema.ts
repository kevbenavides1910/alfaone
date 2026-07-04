import { z } from "zod";

export const ticketListSchema = z.object({
  q: z.string().optional(),
  statusCode: z.string().optional(),
  priorityCode: z.string().optional(),
  assignedToMe: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

import { TICKET_CATEGORY_OTRO_CODE } from "../business/category-codes";

export const ticketCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10).max(8000),
    categoryCode: z.string().trim().min(1),
    categoryDetail: z.string().trim().max(500).optional(),
    priorityCode: z.string().trim().min(1),
    typeCode: z.string().trim().min(1),
    technicianId: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.categoryCode === TICKET_CATEGORY_OTRO_CODE && !data.categoryDetail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indique el detalle para la categoría Otro",
        path: ["categoryDetail"],
      });
    }
  });

export const ticketAssignSchema = z.object({
  assignedToId: z.string().trim().min(1).nullable(),
});

export const ticketStatusSchema = z.object({
  statusCode: z.string().trim().min(1),
  reason: z.string().trim().max(2000).optional(),
  solution: z.string().trim().max(8000).optional(),
  workMinutes: z.coerce.number().int().min(0).optional(),
});

export const ticketCommentSchema = z.object({
  comment: z.string().trim().min(1).max(8000),
  isInternal: z.boolean().optional().default(false),
});

export const ticketSearchSchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(30).optional().default(15),
});

export const catalogUpsertSchema = z.object({
  kind: z.enum(["category", "priority", "status", "type", "closeReason"]),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.coerce.number().int().optional(),
  slaMinutes: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  colorToken: z.string().trim().max(50).optional(),
  isTerminal: z.boolean().optional(),
  pausesSla: z.boolean().optional(),
});

export const catalogItemUpdateSchema = z.object({
  kind: z.enum(["category", "priority", "status", "type", "closeReason", "technician"]),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
  slaMinutes: z.coerce.number().int().min(1).optional(),
  colorToken: z.string().trim().max(50).optional(),
  isTerminal: z.boolean().optional(),
  pausesSla: z.boolean().optional(),
});

export const catalogItemDeleteSchema = z.object({
  kind: z.enum(["category", "priority", "status", "type", "closeReason", "technician"]),
  id: z.string().trim().min(1),
});

export const catalogTechnicianAddSchema = z.object({
  userId: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().optional(),
});

export const prioritySlaUpdateSchema = z.object({
  priorityId: z.string().trim().min(1),
  slaMinutes: z.coerce.number().int().min(1),
});
