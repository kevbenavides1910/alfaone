import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export type MailTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  /** Nombre TLS/SNI si el host de conexión no coincide con el SAN del certificado. */
  tlsServername?: string | null;
};

/**
 * Host SMTP → servername TLS cuando el certificado usa otro nombre (SNI).
 * Certificado del servidor: mail.seguridadalfa.com, srv.grupocorporativoalfa.com
 * (no incluye webmail.seguridadalfa.com).
 */
const TLS_SERVERNAME_BY_HOST: Record<string, string> = {
  "webmail.seguridadalfa.com": "mail.seguridadalfa.com",
  "seguridadalfa.com": "mail.seguridadalfa.com",
};

/**
 * Resuelve el servername para validar el certificado en STARTTLS/SSL.
 * Si el host de conexión difiere del CN/SAN del certificado, hay que indicar el nombre del cert.
 */
export function resolveTlsServername(smtpHost: string, explicit?: string | null): string | undefined {
  const fromExplicit = explicit?.trim();
  if (fromExplicit) return fromExplicit;

  const fromEnv = process.env.SMTP_TLS_SERVERNAME?.trim();
  if (fromEnv) return fromEnv;

  const key = smtpHost.trim().toLowerCase();
  return TLS_SERVERNAME_BY_HOST[key];
}

/** 587 = STARTTLS (secure false); 465 = TLS implícito (secure true). */
export function resolveSmtpSecureFlag(port: number, secure: boolean): boolean {
  if (port === 587 || port === 25) return false;
  if (port === 465) return true;
  return secure;
}

export function buildNodemailerTransportOptions(
  c: MailTransportConfig
): SMTPTransport.Options {
  const secure = resolveSmtpSecureFlag(c.port, c.secure);
  const opts: SMTPTransport.Options = {
    host: c.host,
    port: c.port,
    secure,
    auth: c.user && c.pass ? { user: c.user, pass: c.pass } : undefined,
  };

  const servername = resolveTlsServername(c.host, c.tlsServername);
  if (servername) {
    opts.tls = { servername, minVersion: "TLSv1.2" };
  }

  return opts;
}

export function createMailTransport(c: MailTransportConfig) {
  return nodemailer.createTransport(buildNodemailerTransportOptions(c));
}
