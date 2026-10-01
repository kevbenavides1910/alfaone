import { z } from "zod";
import { reminderKey } from "../business/reminders";

export const reminderInputSchema = z.object({
  offsetValue: z.number().int().min(0).max(3650),
  offsetUnit: z.enum(["DAYS", "MONTHS"]),
});

export const legalDocumentBodySchema = z
  .object({
    type: z.enum([
      "GARANTIA",
      "PERSONERIA",
      "LICENCIA",
      "PERMISO",
      "FRECUENCIA",
      "PATENTE",
      "CONSTANCIA",
      "POLIZA",
    ]),
    otherTypeLabel: z.string().trim().max(80).optional().nullable(),
    policyPercentage: z.string().trim().max(80).optional().nullable(),
    insuredAmountLabel: z.string().trim().max(120).optional().nullable(),
    policyKind: z.enum(["RT", "RC", "FID"]).optional().nullable(),
    tenderNumber: z.string().trim().max(120).optional().nullable(),
    guaranteeEntity: z.string().trim().max(160).optional().nullable(),
    guaranteeNumber: z.string().trim().max(120).optional().nullable(),
    description: z.string().trim().min(1, "La descripción es obligatoria").max(500),
    amount: z.number().finite().min(0, "El monto no puede ser negativo"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La vigencia es inválida"),
    company: z.string().trim().max(40).optional().nullable(),
    referenceNumber: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(4000).optional().nullable(),
    responsibleUserId: z.string().trim().min(1, "El responsable es obligatorio"),
    reminders: z.array(reminderInputSchema).min(1, "Agregá al menos un recordatorio"),
  })
  .superRefine((value, ctx) => {
    if (value.type === "POLIZA" && value.policyKind !== "RT" && value.policyKind !== "RC" && value.policyKind !== "FID") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["policyKind"],
        message: "Seleccioná el tipo de póliza: RT, RC o FID",
      });
    }
    const seen = new Set<string>();
    value.reminders.forEach((reminder, index) => {
      if (reminder.offsetUnit === "MONTHS" && reminder.offsetValue > 240) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reminders", index, "offsetValue"],
          message: "La anticipación en meses no puede superar 240",
        });
      }
      const key = reminderKey(reminder);
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reminders", index],
          message: "Hay dos recordatorios con la misma anticipación",
        });
      }
      seen.add(key);
    });
  });

export const markPaidSchema = z
  .object({
    paid: z.boolean(),
  })
  .strict();

export type LegalDocumentBody = z.infer<typeof legalDocumentBodySchema>;

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}
