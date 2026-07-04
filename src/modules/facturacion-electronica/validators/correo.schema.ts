import { z } from "zod";

export const FE_MAIL_PROVIDERS = ["CUSTOM_SMTP", "OUTLOOK", "GMAIL"] as const;

export const updateFeCorreoSchema = z.object({
  companyCode: z.string().optional(),
  mailProvider: z.enum(FE_MAIL_PROVIDERS).default("CUSTOM_SMTP"),
  smtpHost: z.string().trim().max(200).optional().nullable(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional().nullable(),
  smtpUser: z.string().trim().max(240).optional().nullable(),
  /** Solo se actualiza si se envía (no vacío). */
  smtpPass: z.string().max(500).optional(),
  smtpFrom: z.string().trim().max(240).optional().nullable(),
  correoRemitente: z.string().email().optional().nullable(),
  correoNombre: z.string().max(120).optional().nullable(),
  correoCopiaFija: z.string().max(4000).optional().nullable(),
});

export const testFeCorreoSchema = updateFeCorreoSchema.extend({
  to: z.string().trim().email("Correo destino inválido"),
});

export type UpdateFeCorreoInput = z.infer<typeof updateFeCorreoSchema>;
export type TestFeCorreoInput = z.infer<typeof testFeCorreoSchema>;
