import { z } from "zod";

export const VENTAS_PRESUPUESTO_ESTADOS = ["BORRADOR", "EN_REVISION", "FINALIZADO"] as const;
export const VENTAS_JORNADA_CODIGOS = ["MO1", "MO2", "MO3", "MO4", "MO5"] as const;
export const VENTAS_EQUIPAMIENTOS = ["AF", "ANL", "SA", "L"] as const;

export const presupuestoListSchema = z.object({
  q: z.string().optional(),
  licitacionNo: z.string().optional(),
  estado: z.enum(VENTAS_PRESUPUESTO_ESTADOS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const presupuestoCreateSchema = z.object({
  oportunidadId: z.string().optional(),
  licitacionNo: z.string().min(1),
  compania: z.string().min(1).optional(),
  nombre: z.string().optional(),
  anioBase: z.coerce.number().int().min(2020).max(2035).default(2026),
  polizaInsPct: z.coerce.number().min(0).max(100).default(5.75),
  ivaPct: z.coerce.number().min(0).max(100).default(13),
  margenUtilidadPct: z.coerce.number().min(0).max(100).default(7.523687797366793),
  imprevistosPct: z.coerce.number().min(0).max(100).default(0.01),
});

export const presupuestoUpdateSchema = presupuestoCreateSchema
  .partial()
  .extend({
    estado: z.enum(VENTAS_PRESUPUESTO_ESTADOS).optional(),
  });

export const presupuestoLineaSchema = z.object({
  numeroLinea: z.string().min(1),
  descripcion: z.string().min(1),
  jornadaCodigo: z.enum(VENTAS_JORNADA_CODIGOS),
  equipamiento: z.enum(VENTAS_EQUIPAMIENTOS),
  cantidadPuestos: z.coerce.number().int().min(1),
  factorOficiales: z.coerce.number().min(0.01).default(1),
  codigoHojaInsumo: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
});

export const presupuestoToleranciaSchema = z.object({
  ofertaPropia: z.coerce.number().optional().nullable(),
  ofertaCompetencia: z.coerce.number().optional().nullable(),
  ofertaCliente: z.coerce.number().optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

export type PresupuestoListInput = z.infer<typeof presupuestoListSchema>;
export type PresupuestoCreateInput = z.infer<typeof presupuestoCreateSchema>;
export type PresupuestoUpdateInput = z.infer<typeof presupuestoUpdateSchema>;
export type PresupuestoLineaInput = z.infer<typeof presupuestoLineaSchema>;
export type PresupuestoToleranciaInput = z.infer<typeof presupuestoToleranciaSchema>;
