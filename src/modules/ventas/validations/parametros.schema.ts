import { z } from "zod";

export const parametrosGeneralesUpdateSchema = z.object({
  compania: z.string().min(1).optional(),
  anioBase: z.coerce.number().int().min(2020).max(2035).optional(),
  polizaInsPct: z.coerce.number().min(0).max(100).optional(),
  ivaPct: z.coerce.number().min(0).max(100).optional(),
  margenUtilidadPct: z.coerce.number().min(0).max(100).optional(),
  imprevistosPct: z.coerce.number().min(0).max(100).optional(),
});

export const catalogSectionSchema = z.enum([
  "salarios",
  "jornadas",
  "cargasSociales",
  "pagosExtras",
  "insumos",
  "gastosAdmin",
  "indices",
]);

export const catalogItemUpdateSchema = z.object({
  section: catalogSectionSchema,
  codigo: z.string().min(1),
  field: z.string().min(1),
  value: z.union([z.number(), z.record(z.string(), z.number()), z.null()]),
});

export type ParametrosGeneralesUpdateInput = z.infer<typeof parametrosGeneralesUpdateSchema>;
export type CatalogItemUpdateInput = z.infer<typeof catalogItemUpdateSchema>;

export const catalogItemCreateSchema = z.object({
  section: catalogSectionSchema,
  item: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.array(z.string()), z.record(z.string(), z.number())])
  ),
});

export const catalogItemDeleteSchema = z.object({
  section: catalogSectionSchema,
  codigo: z.string().min(1),
});

export type CatalogItemCreateInput = z.infer<typeof catalogItemCreateSchema>;
export type CatalogItemDeleteInput = z.infer<typeof catalogItemDeleteSchema>;
export type CatalogSection = z.infer<typeof catalogSectionSchema>;
