import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)");

function parseTipoDocs(value: unknown): string[] {
  if (value == null || value === "" || value === "ALL") return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => String(v).split(","))
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .filter((s) => s !== "ALL");
  }
  return String(value)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((s) => s !== "ALL");
}

export const cxpMovimientosListSchema = z
  .object({
    dateFrom: isoDate,
    dateTo: isoDate,
    company: z.string().trim().optional(),
    noProve: z.string().trim().optional(),
    /** Multi-tipo: NC, ND, FA, TR, etc. Vacío = todos. */
    tipoDocs: z.preprocess(parseTipoDocs, z.array(z.string().min(1).max(10)).default([])),
    /** Clase ARCPTD.DOCUMENTO: F, K, O, A. */
    documentoClase: z
      .string()
      .trim()
      .toUpperCase()
      .optional()
      .transform((v) => (v && v !== "ALL" ? v : undefined)),
    search: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .superRefine((data, ctx) => {
    if (data.dateFrom > data.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha desde no puede ser posterior a la fecha hasta",
        path: ["dateFrom"],
      });
    }
    const from = new Date(`${data.dateFrom}T00:00:00Z`);
    const to = new Date(`${data.dateTo}T00:00:00Z`);
    const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (days > 366) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El rango máximo es de 366 días",
        path: ["dateTo"],
      });
    }
  });

export type CxpMovimientosListInput = z.infer<typeof cxpMovimientosListSchema>;
