import { z } from "zod";

export const nafCargasSocialesUpdateSchema = z.object({
  noCia: z.string().min(1),
  codigo: z.string().min(1),
  porcentaje: z.number().finite().min(0).max(100),
});

export const nafCargasSocialesCreateSchema = z.object({
  noCia: z.string().min(1),
  item: z.object({
    nombre: z.string().min(1),
    porcentaje: z.number().finite().min(0).max(100),
    grupo: z.string().optional(),
    codigo: z.string().optional(),
  }),
});

export const nafCargasSocialesDeleteSchema = z.object({
  noCia: z.string().min(1),
  codigo: z.string().min(1),
});
