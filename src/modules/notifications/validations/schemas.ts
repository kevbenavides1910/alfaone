import { z } from "zod";

export const notificationEventSchema = z.object({
  typeCode: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  moduleKey: z.string().min(1),
  entityType: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  href: z.string().optional().nullable(),
  priority: z.enum(["INFO", "WARNING", "ERROR", "SUCCESS", "URGENT"]).optional(),
  recipientUserIds: z.array(z.string()).optional(),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  action: z.enum(["read", "archive", "delete"]),
});

export const preferencesUpdateSchema = z.object({
  preferences: z.array(
    z.object({
      typeId: z.string().min(1),
      enabled: z.boolean(),
    }),
  ),
});

export const historyQuerySchema = z.object({
  q: z.string().optional(),
  moduleKey: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});
