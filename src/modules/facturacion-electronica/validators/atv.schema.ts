import { z } from "zod";
import { normalizeAtvUsuarioInput } from "../utils/fe-atv-usuario";

export const testFeAtvSchema = z.object({
  companyCode: z.string().optional(),
  atvUsuario: z
    .string()
    .max(160)
    .optional()
    .transform((v) => normalizeAtvUsuarioInput(v)),
  atvPassword: z.string().min(1).max(200).optional(),
  /** Si se indica, fuerza el test contra ese ambiente (independiente del ambient guardado en DB). */
  forAmbiente: z.enum(["STAGING", "PRODUCCION"]).optional(),
});

export type TestFeAtvInput = z.infer<typeof testFeAtvSchema>;
