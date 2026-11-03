import { z } from "zod";
import { isActividadEnCatalogo, toTribuCodigo } from "../utils/hacienda-actividad";
import { normalizeIdentificacion, validateIdentificacion } from "../utils/fe-identificacion";

const feClienteFieldsSchema = z.object({
  tipoIdentificacion: z.enum(["FISICA", "JURIDICA", "DIMEX", "NITE", "EXTRANJERO"]),
  identificacion: z.string().min(1),
  nombre: z.string().min(1),
  nombreComercial: z.string().optional(),
  actividadEconomica: z.string().max(20).optional(),
  email: z.string().email().optional(),
  emailCopia: z.string().email().optional(),
  telefono: z.string().optional(),
  direccionProvincia: z.string().optional(),
  direccionCanton: z.string().optional(),
  direccionDistrito: z.string().optional(),
  direccionBarrio: z.string().max(50).optional(),
  direccionOtras: z.string().optional(),
  externalRef: z.string().optional(),
});

function refineActividadEconomica<T extends { actividadEconomica?: string }>(data: T, ctx: z.RefinementCtx) {
  const raw = data.actividadEconomica?.trim();
  if (!raw) return;
  const tribu = toTribuCodigo(raw);
  if (!tribu || !isActividadEnCatalogo(tribu)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Actividad económica inválida (catálogo TRIBU, ej. 8010.0)",
      path: ["actividadEconomica"],
    });
  }
}

export const createFeClienteSchema = feClienteFieldsSchema
  .transform((data) => ({
    ...data,
    identificacion: normalizeIdentificacion(data.identificacion, data.tipoIdentificacion),
  }))
  .superRefine((data, ctx) => {
    refineActividadEconomica(data, ctx);
    const err = validateIdentificacion(data.tipoIdentificacion, data.identificacion);
    if (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: err, path: ["identificacion"] });
    }
  });

export type CreateFeClienteInput = z.infer<typeof createFeClienteSchema>;

export const updateFeClienteSchema = feClienteFieldsSchema
  .partial()
  .transform((data) => ({
    ...data,
    ...(data.identificacion != null
      ? { identificacion: normalizeIdentificacion(data.identificacion, data.tipoIdentificacion) }
      : {}),
  }))
  .superRefine(refineActividadEconomica)
  .refine((data) => Object.keys(data).length > 0, "Debe indicar al menos un campo para actualizar");

export type UpdateFeClienteInput = z.infer<typeof updateFeClienteSchema>;
