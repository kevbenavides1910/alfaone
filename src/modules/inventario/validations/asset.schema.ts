import { z } from "zod";

export const assetItemSchema = z.object({
  code: z.string().min(1).max(120),
  name: z.string().max(200).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  attributes: z.record(z.unknown()).default({}),
});

export const assetIntakeCreateSchema = z.object({
  typeId: z.string().min(1),
  intakeReason: z.enum(["PURCHASE", "RETURN", "INITIAL", "OTHER"]).default("PURCHASE"),
  expenseId: z.string().optional().nullable(),
  acquisitionDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(assetItemSchema).min(1, "Al menos un activo"),
});

export const assetPatchSchema = z.object({
  code: z.string().min(1).max(120).optional(),
  name: z.string().max(200).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  model: z.string().max(120).nullable().optional(),
  attributes: z.record(z.unknown()).optional(),
  acquisitionExpenseId: z.string().nullable().optional(),
  acquisitionDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const assignSchema = z.object({
  action: z.literal("ASSIGN"),
  toPositionId: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const returnSchema = z.object({
  action: z.literal("RETURN"),
  notes: z.string().optional().nullable(),
});

const issueSchema = z.object({
  action: z.literal("ISSUE"),
  reason: z.enum(["LOST", "DAMAGED", "DISPOSED", "OTHER"]),
  notes: z.string().optional().nullable(),
});

export const assetMovementActionSchema = z.discriminatedUnion("action", [
  assignSchema,
  returnSchema,
  issueSchema,
]);

export type AssetIntakeCreateInput = z.infer<typeof assetIntakeCreateSchema>;
export type AssetPatchInput = z.infer<typeof assetPatchSchema>;
export type AssetMovementActionInput = z.infer<typeof assetMovementActionSchema>;
