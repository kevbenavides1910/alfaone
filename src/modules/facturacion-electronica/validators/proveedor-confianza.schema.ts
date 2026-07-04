import { z } from "zod";

export const createFeProveedorConfianzaSchema = z.object({
  cedula: z.string().min(9).max(20),
  nombre: z.string().trim().optional(),
  autoAceptar: z.boolean().default(true),
});

export type CreateFeProveedorConfianzaInput = z.infer<typeof createFeProveedorConfianzaSchema>;

export const updateFeProveedorConfianzaSchema = z.object({
  nombre: z.string().trim().optional().nullable(),
  autoAceptar: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateFeProveedorConfianzaInput = z.infer<typeof updateFeProveedorConfianzaSchema>;
