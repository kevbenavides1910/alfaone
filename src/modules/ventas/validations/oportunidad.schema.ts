import { z } from "zod";

export const VENTAS_OPORTUNIDAD_ESTADOS = [
  "PENDIENTE_DECIDIR",
  "PARTICIPAR",
  "NO_PARTICIPAR",
] as const;

export type VentasOportunidadEstado = (typeof VENTAS_OPORTUNIDAD_ESTADOS)[number];

const dateString = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha inválida");

export const oportunidadListSchema = z.object({
  q: z.string().optional(),
  licitacionNo: z.string().optional(),
  cliente: z.string().optional(),
  estado: z.enum(VENTAS_OPORTUNIDAD_ESTADOS).optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const oportunidadCreateSchema = z.object({
  licitacionNo: z.string().min(1, "Número de licitación requerido"),
  cliente: z.string().min(1, "Cliente requerido"),
  descripcion: z.string().min(1, "Descripción requerida"),
  fechaPresentacion: dateString,
  enlace: z.string().optional(),
  source: z.string().optional(),
});

export const oportunidadIngestItemSchema = z.object({
  licitacionNo: z.string().min(1),
  cliente: z.string().min(1),
  descripcion: z.string().min(1),
  fechaPresentacion: dateString,
  enlace: z.string().optional(),
  inicioRecepcion: z.string().optional(),
  cierreRecepcion: z.string().optional(),
  montoContratacion: z.string().optional(),
  monedaContratacion: z.string().optional(),
  fechaAclaracion: z.string().optional(),
  fechaObjeciones: z.string().optional(),
});

export const oportunidadIngestSchema = z.union([
  oportunidadIngestItemSchema,
  z.object({
    licitaciones: z.array(oportunidadIngestItemSchema).min(1),
  }),
]);

export const oportunidadUpdateEstadoSchema = z.object({
  estado: z.enum(["PARTICIPAR", "NO_PARTICIPAR", "PENDIENTE_DECIDIR"]),
});

export type OportunidadListInput = z.infer<typeof oportunidadListSchema>;
export type OportunidadCreateInput = z.infer<typeof oportunidadCreateSchema>;
export type OportunidadIngestInput = z.infer<typeof oportunidadIngestSchema>;
export type OportunidadUpdateEstadoInput = z.infer<typeof oportunidadUpdateEstadoSchema>;
