import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import {
  FACTURACION_COBRO_MAIL_PROVIDERS,
  ensureFacturacionCobroSettingsRow,
  normalizeFacturacionMailProvider,
} from "@/modules/presupuestos/services/facturacion-cobro-settings";

const patchSchema = z.object({
  emailFixedCc: z.string().trim().max(4000).optional().nullable(),
  emailSubjectTemplate: z.string().trim().min(3).max(300).optional(),
  emailBodyTemplate: z.string().trim().min(3).max(8000).optional(),
  dueReminderDaysBefore: z.number().int().min(1).max(90).optional(),
  dueReminderSubjectTemplate: z.string().trim().min(3).max(300).optional(),
  dueReminderBodyTemplate: z.string().trim().min(3).max(8000).optional(),
  autoDueReminderEnabled: z.boolean().optional(),
  autoCollectionEnabled: z.boolean().optional(),
  collectionEmailIntervalDays: z.number().int().min(1).max(90).optional(),
  mailProvider: z.enum(FACTURACION_COBRO_MAIL_PROVIDERS).optional(),
  smtpHost: z.string().trim().max(200).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional().nullable(),
  smtpUser: z.string().trim().max(240).optional().nullable(),
  smtpPass: z.string().max(500).optional().nullable(),
  smtpFrom: z.string().trim().max(240).optional().nullable(),
});

function cleanNullable(v: string | null | undefined): string | null {
  if (v === undefined) return null;
  if (v === null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "view")) return forbidden();
  try {
    const row = await ensureFacturacionCobroSettingsRow();
    return ok({
      ...row,
      smtpPass: row.smtpPass ? "********" : "",
    });
  } catch (e) {
    return serverError("Error al cargar configuración de correo de cobro", e);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "edit")) return forbidden();
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    const body = parsed.data;

    const updates: Record<string, unknown> = {};
    if (body.emailFixedCc !== undefined) updates.emailFixedCc = cleanNullable(body.emailFixedCc);
    if (body.emailSubjectTemplate !== undefined) updates.emailSubjectTemplate = body.emailSubjectTemplate;
    if (body.emailBodyTemplate !== undefined) updates.emailBodyTemplate = body.emailBodyTemplate;
    if (body.dueReminderDaysBefore !== undefined) {
      updates.dueReminderDaysBefore = body.dueReminderDaysBefore;
    }
    if (body.dueReminderSubjectTemplate !== undefined) {
      updates.dueReminderSubjectTemplate = body.dueReminderSubjectTemplate;
    }
    if (body.dueReminderBodyTemplate !== undefined) {
      updates.dueReminderBodyTemplate = body.dueReminderBodyTemplate;
    }
    if (body.autoDueReminderEnabled !== undefined) {
      updates.autoDueReminderEnabled = body.autoDueReminderEnabled;
    }
    if (body.autoCollectionEnabled !== undefined) {
      updates.autoCollectionEnabled = body.autoCollectionEnabled;
    }
    if (body.collectionEmailIntervalDays !== undefined) {
      updates.collectionEmailIntervalDays = body.collectionEmailIntervalDays;
    }
    if (body.mailProvider !== undefined) {
      updates.mailProvider = normalizeFacturacionMailProvider(body.mailProvider);
    }
    if (body.smtpHost !== undefined) updates.smtpHost = cleanNullable(body.smtpHost);
    if (body.smtpPort !== undefined) updates.smtpPort = body.smtpPort ?? null;
    if (body.smtpSecure !== undefined) updates.smtpSecure = body.smtpSecure ?? null;
    if (body.smtpUser !== undefined) updates.smtpUser = cleanNullable(body.smtpUser);
    if (body.smtpFrom !== undefined) updates.smtpFrom = cleanNullable(body.smtpFrom);
    if (body.smtpPass !== undefined) {
      const pass = body.smtpPass?.trim() ?? "";
      updates.smtpPass = pass.length > 0 ? pass : null;
    }
    if (Object.keys(updates).length === 0) return badRequest("No hay cambios para guardar");

    await ensureFacturacionCobroSettingsRow();
    const row = await prisma.appFacturacionCobroSettings.update({
      where: { id: "default" },
      data: updates,
    });
    return ok({
      ...row,
      smtpPass: row.smtpPass ? "********" : "",
    });
  } catch (e) {
    return serverError("Error al guardar configuración de correo de cobro", e);
  }
}
