import { z } from "zod";

export const cxpEstadoPagoSchema = z.enum([
  "PENDIENTE",
  "PARCIAL",
  "PAGADA",
  "ANULADA",
  "SIN_CXP",
]);

/** @deprecated usar estados[] — se mantiene para compat. */
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

function parseEstadosInput(value: unknown): string[] {
  if (value == null || value === "" || value === "ALL") return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => String(v).split(","))
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => s !== "ALL");
  }
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== "ALL");
}

export const cxpFacturasListSchema = z.object({
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2000).max(2100),
  company: z.string().trim().optional(),
  noProve: z.string().trim().optional(),
  tipoDoc: z.string().trim().optional(),
  search: z.string().trim().optional(),
  /** Multi-estado. Vacío = todos. */
  estados: z.preprocess(
    parseEstadosInput,
    z.array(cxpEstadoPagoSchema).default([]),
  ),
  /** Compat: un solo estado. Si viene y estados vacío, se aplica. */
  estado: cxpEstadoFilterSchema.optional(),
  faeLink: cxpFaeLinkFilterSchema.optional().default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
}).transform((data) => {
  let estados = data.estados ?? [];
  if (estados.length === 0 && data.estado && data.estado !== "ALL") {
    estados = [data.estado];
  }
  return { ...data, estados };
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
