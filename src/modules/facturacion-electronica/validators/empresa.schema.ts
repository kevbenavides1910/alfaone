import { z } from "zod";
import { validateIdentificacion } from "../utils/fe-identificacion";
import { normalizeAtvUsuarioInput } from "../utils/fe-atv-usuario";

export const upsertFeEmpresaSchema = z
  .object({
    nombreComercial: z.string().min(1).max(200),
    razonSocial: z.string().min(1).max(200),
    tipoIdentificacion: z.enum(["FISICA", "JURIDICA", "DIMEX", "NITE", "EXTRANJERO"]).default("JURIDICA"),
    cedulaJuridica: z
      .string()
      .min(1)
      .transform((v) => v.replace(/\D/g, "")),
    actividadEconomica: z.string().max(20).optional().nullable(),
    proveedorSistemas: z
      .string()
      .max(20)
      .optional()
      .nullable()
      .transform((v) => (v?.trim() ? v.replace(/\D/g, "") : null)),
    exigirUbicacionReceptor: z.boolean().default(true),
    ambiente: z.enum(["STAGING", "PRODUCCION"]).default("STAGING"),
    correoRemitente: z.string().email().optional().nullable(),
    correoNombre: z.string().max(120).optional().nullable(),
    telefono: z.string().max(30).optional().nullable(),
    email: z.string().email().optional().nullable(),
    direccionProvincia: z.string().max(100).optional().nullable(),
    direccionCanton: z.string().max(100).optional().nullable(),
    direccionDistrito: z.string().max(100).optional().nullable(),
    direccionBarrio: z.string().max(50).optional().nullable(),
    direccionOtras: z.string().max(500).optional().nullable(),
    atvUsuario: z
      .string()
      .max(160)
      .optional()
      .nullable()
      .transform((v) => normalizeAtvUsuarioInput(v)),
    /** Solo se actualiza si se envía (no vacío). */
    atvPassword: z.string().min(1).max(200).optional(),
    atvUsuarioStg: z
      .string()
      .max(160)
      .optional()
      .nullable()
      .transform((v) => normalizeAtvUsuarioInput(v)),
    /** Solo se actualiza si se envía (no vacío). */
    atvPasswordStg: z.string().min(1).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const err = validateIdentificacion(data.tipoIdentificacion, data.cedulaJuridica);
    if (err) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: err, path: ["cedulaJuridica"] });
    }
  });

export type UpsertFeEmpresaInput = z.infer<typeof upsertFeEmpresaSchema>;

export const uploadFeCertificadoSchema = z.object({
  password: z.string().min(1).max(200),
});

export const createFeSucursalSchema = z.object({
  codigo: z
    .string()
    .regex(/^\d{1,3}$/, "Código de sucursal numérico (1-3 dígitos)")
    .transform((v) => v.padStart(3, "0")),
  nombre: z.string().min(1).max(120),
  telefono: z.string().max(30).optional().nullable(),
  direccion: z.string().max(500).optional().nullable(),
});

export const updateFeSucursalSchema = createFeSucursalSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createFePuntoVentaSchema = z.object({
  codigo: z
    .string()
    .regex(/^\d{1,5}$/, "Código terminal numérico (1-5 dígitos)")
    .transform((v) => v.padStart(5, "0")),
  nombre: z.string().min(1).max(120),
});

export const updateFePuntoVentaSchema = createFePuntoVentaSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateFeSucursalInput = z.infer<typeof createFeSucursalSchema>;
export type UpdateFeSucursalInput = z.infer<typeof updateFeSucursalSchema>;
export type CreateFePuntoVentaInput = z.infer<typeof createFePuntoVentaSchema>;
export type UpdateFePuntoVentaInput = z.infer<typeof updateFePuntoVentaSchema>;
