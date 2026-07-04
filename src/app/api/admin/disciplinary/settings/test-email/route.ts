import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, isAdmin } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { DISCIPLINARY_MAIL_PROVIDERS, ensureDisciplinarySettingsRow } from "@/modules/disciplinario/services/disciplinary-settings";
import { mergeDisciplinaryCc, sendDisciplinaryOmisionEmail } from "@/modules/disciplinario/services/disciplinary-email";
import { createTransportFromConfig, resolveSmtpConfig } from "@/modules/disciplinario/services/disciplinary-smtp";
import {
  buildDisciplinaryTestEmailContent,
  buildDisciplinaryTestPdfBytes,
} from "@/modules/disciplinario/services/disciplinary-test-email";

const bodySchema = z.object({
  to: z.string().trim().email("Correo destino inválido"),
  /** Si se envía (incluso cadena vacía), sustituye al CC fijo guardado para esta prueba. */
  emailFixedCc: z.string().max(4000).optional().nullable(),
  emailSubjectTemplate: z.string().max(500).optional().nullable(),
  emailBodyTemplate: z.string().max(8000).optional().nullable(),
  mailProvider: z.enum(DISCIPLINARY_MAIL_PROVIDERS).optional(),
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
  if (!isAdmin(session)) return forbidden();

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await ensureDisciplinarySettingsRow();
    const overrides: Parameters<typeof resolveSmtpConfig>[1] = {};
    if (parsed.data.mailProvider !== undefined) overrides.mailProvider = parsed.data.mailProvider;
    if (parsed.data.smtpHost !== undefined) overrides.smtpHost = parsed.data.smtpHost;
    if (parsed.data.smtpPort !== undefined) overrides.smtpPort = parsed.data.smtpPort;
    if (parsed.data.smtpSecure !== undefined) overrides.smtpSecure = parsed.data.smtpSecure;
    if (parsed.data.smtpUser !== undefined) overrides.smtpUser = parsed.data.smtpUser;
    if (parsed.data.smtpFrom !== undefined) overrides.smtpFrom = parsed.data.smtpFrom;
    if (parsed.data.smtpPass !== undefined) overrides.smtpPass = parsed.data.smtpPass;

    const hasOverrides = Object.keys(overrides).length > 0;
    const cfg = resolveSmtpConfig(row, hasOverrides ? overrides : undefined);
    if (!cfg) {
      return badRequest(
        "No hay servidor SMTP configurado. Indique host (o elija Outlook/Gmail) y guarde o envíe los datos en la prueba.",
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

    const emailContent = buildDisciplinaryTestEmailContent(row, {
      emailSubjectTemplate: parsed.data.emailSubjectTemplate,
      emailBodyTemplate: parsed.data.emailBodyTemplate,
    });
    const pdfBytes = await buildDisciplinaryTestPdfBytes(row);

    const transport = createTransportFromConfig(cfg);
    await sendDisciplinaryOmisionEmail({
      transport,
      from: cfg.from,
      to: parsed.data.to,
      cc,
      subject: emailContent.subject,
      text: emailContent.text,
      pdfFilename: emailContent.pdfFilename,
      pdfBytes,
    });

    return ok({ sentTo: parsed.data.to, cc: cc ?? null, pdfAttached: true });
  } catch (e) {
    console.warn("[POST /api/admin/disciplinary/settings/test-email]", e);
    const msg = e instanceof Error ? e.message : "Error SMTP";
    return badRequest(`No se pudo enviar el correo de prueba: ${msg}`);
  }
}
