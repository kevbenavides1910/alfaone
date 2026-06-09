import { z } from "zod";

export const assetTypeFieldSchema = z.object({
  key: z.string().min(1).max(60).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Clave inválida (solo letras, números y _)"),
  label: z.string().min(1).max(80),
  type: z.enum(["string", "number", "date", "boolean"]).default("string"),
  required: z.boolean().default(false),
});

export const assetTypeCreateSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9_]+$/, "Sólo mayúsculas, números y _"),
  name: z.string().min(2).max(100),
  fields: z.array(assetTypeFieldSchema).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const assetTypePatchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  fields: z.array(assetTypeFieldSchema).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type AssetTypeCreateInput = z.infer<typeof assetTypeCreateSchema>;
export type AssetTypePatchInput = z.infer<typeof assetTypePatchSchema>;
