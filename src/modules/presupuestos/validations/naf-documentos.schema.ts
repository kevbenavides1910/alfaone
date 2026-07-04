import { z } from "zod";

export const nafDocumentosListSchema = z.object({
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  company: z.string().trim().optional(),
  tipoDoc: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type NafDocumentosListInput = z.infer<typeof nafDocumentosListSchema>;

export const nafDocumentoPdfSchema = z.object({
  noCia: z.string().trim().min(1),
  tipoDoc: z.string().trim().min(1),
  noFactu: z.string().trim().min(1),
  companyCode: z.string().trim().optional(),
  claveFactura: z.string().trim().optional(),
  consecutivoFe: z.string().trim().optional(),
});

export type NafDocumentoPdfInput = z.infer<typeof nafDocumentoPdfSchema>;
