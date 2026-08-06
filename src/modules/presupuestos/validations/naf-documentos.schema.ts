import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

export const nafDocumentosListSchema = z
  .object({
    /** Rango explícito (preferido en la UI de Documentos NAF). */
    dateFrom: isoDate.optional(),
    dateTo: isoDate.optional(),
    /** Compat: diálogo de ligue y clientes que aún envían mes/año. */
    periodMonth: z.coerce.number().int().min(1).max(12).optional(),
    periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
    company: z.string().trim().optional(),
    tipoDoc: z.string().trim().optional(),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
    ligadoFilter: z.enum(["ALL", "LIGADOS", "NO_LIGADOS"]).optional().default("ALL"),
  })
  .superRefine((data, ctx) => {
    const hasRange = Boolean(data.dateFrom && data.dateTo);
    const hasPeriod = data.periodMonth != null && data.periodYear != null;
    if (!hasRange && !hasPeriod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indique dateFrom/dateTo o periodMonth/periodYear",
        path: ["dateFrom"],
      });
      return;
    }
    if (hasRange) {
      if (data.dateFrom! > data.dateTo!) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha desde no puede ser posterior a la fecha hasta",
          path: ["dateFrom"],
        });
      }
      const from = new Date(`${data.dateFrom!}T00:00:00Z`);
      const to = new Date(`${data.dateTo!}T00:00:00Z`);
      const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
      if (days > 366) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El rango máximo es de 366 días",
          path: ["dateTo"],
        });
      }
    }
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
