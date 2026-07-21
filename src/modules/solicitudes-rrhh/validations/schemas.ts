import { z } from "zod";
import { HR_TRAMITES } from "@/modules/solicitudes-rrhh/business/tramites";

export const lookupSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(/^\d{5,20}$/, "Ingrese solo dígitos (sin espacios ni guiones)"),
});

export const requestOtpSchema = z.object({
  cedula: z
    .string()
    .trim()
    .regex(/^\d{5,20}$/, "Ingrese solo dígitos (sin espacios ni guiones)"),
  tramite: z.enum([HR_TRAMITES.CARTA_FCL, HR_TRAMITES.CARTA_SERVICIO]),
});

export const verifyOtpSchema = z.object({
  sessionId: z.string().cuid(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe ser de 6 dígitos"),
});

export const settingsPatchSchema = z.object({
  signerName: z.string().trim().min(3).max(180).optional(),
  signerTitle: z.string().trim().min(3).max(180).optional(),
  companyLegalName: z.string().trim().min(3).max(240).optional(),
  companyIdNumber: z.string().trim().min(3).max(80).optional(),
  companyAddress: z.string().trim().min(3).max(400).optional(),
  companyPhone: z.string().trim().min(3).max(120).optional(),
  corporateGroupText: z.string().trim().min(20).max(8000).optional(),
  emailFixedCc: z.string().trim().max(4000).optional().nullable(),
  otpSubjectTemplate: z.string().trim().min(3).max(300).optional(),
  otpBodyTemplate: z.string().trim().min(10).max(8000).optional(),
  clearDocumentSignature: z.boolean().optional(),
});
