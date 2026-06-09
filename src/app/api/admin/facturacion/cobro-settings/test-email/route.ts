import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { mergeDisciplinaryCc } from "@/modules/disciplinario/services/disciplinary-email";
import {
  FACTURACION_COBRO_MAIL_PROVIDERS,
  ensureFacturacionCobroSettingsRow,
} from "@/modules/presupuestos/services/facturacion-cobro-settings";
import {
  createTransportFromConfig,
  resolveFacturacionCobroSmtpConfig,
} from "@/modules/presupuestos/services/facturacion-cobro-smtp";
import {
  buildCobroEmailContent,
  sampleCobroTemplateValues,
  sendCobroCollectionEmail,
} from "@/modules/presupuestos/services/facturacion-cobro-email";

const bodySchema = z.object({
  to: z.string().trim().email("Correo destino inválido"),
  templateType: z.enum(["collection", "due_reminder"]).default("collection"),
  emailFixedCc: z.string().max(4000).optional().nullable(),
  emailSubjectTemplate: z.string().max(500).optional().nullable(),
  emailBodyTemplate: z.string().max(8000).optional().nullable(),
  dueReminderSubjectTemplate: z.string().max(500).optional().nullable(),
  dueReminderBodyTemplate: z.string().max(8000).optional().nullable(),
  mailProvider: z.enum(FACTURACION_COBRO_MAIL_PROVIDERS).optional(),
  smtpHost: z.string().trim().max(200).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional().nullable(),
  smtpUser: z.string().trim().max(240).optional().nullable(),
  smtpPass: z.string().max(500).optional(),
  smtpFrom: z.string().trim().max(240).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "edit")) return forbidden();

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await ensureFacturacionCobroSettingsRow();
    const overrides: Parameters<typeof resolveFacturacionCobroSmtpConfig>[1] = {};
    if (parsed.data.mailProvider !== undefined) overrides.mailProvider = parsed.data.mailProvider;
    if (parsed.data.smtpHost !== undefined) overrides.smtpHost = parsed.data.smtpHost;
    if (parsed.data.smtpPort !== undefined) overrides.smtpPort = parsed.data.smtpPort;
    if (parsed.data.smtpSecure !== undefined) overrides.smtpSecure = parsed.data.smtpSecure;
    if (parsed.data.smtpUser !== undefined) overrides.smtpUser = parsed.data.smtpUser;
    if (parsed.data.smtpFrom !== undefined) overrides.smtpFrom = parsed.data.smtpFrom;
    if (parsed.data.smtpPass !== undefined) overrides.smtpPass = parsed.data.smtpPass;

    const hasOverrides = Object.keys(overrides).length > 0;
    const cfg = resolveFacturacionCobroSmtpConfig(row, hasOverrides ? overrides : undefined);
    if (!cfg) {
      return badRequest(
        "No hay servidor SMTP configurado. Indique host (o elija Outlook/Gmail) y guarde o envíe los datos en la prueba."
      );
    }
    if (cfg.user && !cfg.pass) {
      return badRequest("Falta contraseña SMTP (o guarde la configuración con contraseña).");
    }

    const fixedForTest =
      parsed.data.emailFixedCc !== undefined
        ? parsed.data.emailFixedCc?.trim() || null
        : row.emailFixedCc;
    const cc = mergeDisciplinaryCc(parsed.data.to, fixedForTest);

    const kind = parsed.data.templateType;
    const values = sampleCobroTemplateValues(kind);
    const emailContent = buildCobroEmailContent(row, values, kind, {
      emailSubjectTemplate: parsed.data.emailSubjectTemplate,
      emailBodyTemplate: parsed.data.emailBodyTemplate,
      dueReminderSubjectTemplate: parsed.data.dueReminderSubjectTemplate,
      dueReminderBodyTemplate: parsed.data.dueReminderBodyTemplate,
      emailFixedCc: fixedForTest,
    });

    const transport = createTransportFromConfig(cfg);
    await sendCobroCollectionEmail({
      transport,
      from: cfg.from,
      to: parsed.data.to,
      cc,
      subject: `[Prueba] ${emailContent.subject}`,
      text: emailContent.text,
    });

    return ok({ sentTo: parsed.data.to, cc: cc ?? null, templateType: kind });
  } catch (e) {
    console.warn("[POST /api/admin/facturacion/cobro-settings/test-email]", e);
    const msg = e instanceof Error ? e.message : "Error SMTP";
    return badRequest(`No se pudo enviar el correo de prueba: ${msg}`);
  }
}
