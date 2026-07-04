import { z } from "zod";

export const createFeCabysFavoritoSchema = z.object({
  codigo: z
    .string()
    .min(1)
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 13, "Código CABYS debe tener 13 dígitos"),
  descripcion: z.string().min(1).max(200),
  impuesto: z.coerce.number().nonnegative().optional().nullable(),
});

export type CreateFeCabysFavoritoInput = z.infer<typeof createFeCabysFavoritoSchema>;
