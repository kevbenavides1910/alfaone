import { z } from "zod";

export const cxpEstadoFilterSchema = z.enum([
  "ALL",
  "PENDIENTE",
  "PARCIAL",
  "PAGADA",
  "ANULADA",
  "SIN_CXP",
]);

export const cxpFaeLinkFilterSchema = z.enum([
  "ALL",
  "CON_FAE",
  "SIN_FAE",
  "FAE_PENDIENTE",
]);

export const cxpFacturasListSchema = z.object({
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  company: z.string().trim().optional(),
  noProve: z.string().trim().optional(),
  tipoDoc: z.string().trim().optional(),
  search: z.string().trim().optional(),
  estado: cxpEstadoFilterSchema.optional().default("ALL"),
  faeLink: cxpFaeLinkFilterSchema.optional().default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type CxpFacturasListInput = z.infer<typeof cxpFacturasListSchema>;

export const cxpProveedoresListSchema = z.object({
  company: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CxpProveedoresListInput = z.infer<typeof cxpProveedoresListSchema>;

export const cxpAmarresParamsSchema = z.object({
  noCia: z.string().trim().min(1),
  tipoDoc: z.string().trim().min(1),
  noDocu: z.string().trim().min(1),
  noProve: z.string().trim().optional(),
});

export type CxpAmarresParamsInput = z.infer<typeof cxpAmarresParamsSchema>;
