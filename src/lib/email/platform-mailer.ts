import nodemailer from "nodemailer";
import { prisma } from "@/modules/core/db/prisma";
import { buildNodemailerTransportOptions } from "./nodemailer-transport";

export interface PlatformMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
}

/** Lee la configuración SMTP de plataforma y envía un correo. */
export async function sendPlatformMail(opts: PlatformMailOptions) {
  const cfg = await prisma.appPlatformSettings.findUnique({ where: { id: "default" } });

  if (!cfg?.smtpHost || !cfg.smtpPort || !cfg.smtpFrom) {
    // Sin SMTP configurado: loguear y continuar (no lanzar error)
    console.warn("[platform-mail] SMTP no configurado — correo no enviado:", opts.subject);
    return { ok: false, reason: "smtp_not_configured" };
  }

  const transport = nodemailer.createTransport(
    buildNodemailerTransportOptions({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure ?? false,
      user: cfg.smtpUser ?? undefined,
      pass: cfg.smtpPass ?? undefined,
      from: cfg.smtpFrom,
    })
  );

  await transport.sendMail({
    from: cfg.smtpFrom,
    to: opts.to,
    cc: opts.cc,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  return { ok: true };
}
