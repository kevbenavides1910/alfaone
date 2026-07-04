import type { FeEmpresa } from "@prisma/client";
import type { MailTransportConfig } from "@/lib/email/nodemailer-transport";
import { FE_MAIL_PROVIDERS } from "../../validators/correo.schema";

export type FeSmtpSource = Pick<
  FeEmpresa,
  | "mailProvider"
  | "smtpHost"
  | "smtpPort"
  | "smtpSecure"
  | "smtpUser"
  | "smtpPass"
  | "smtpFrom"
  | "correoRemitente"
  | "correoNombre"
>;

export type FeSmtpOverrides = Partial<{
  mailProvider: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPass: string | undefined;
  smtpFrom: string | null;
  correoRemitente: string | null;
  correoNombre: string | null;
}>;

function normalizeProvider(provider: string | null | undefined) {
  const p = (provider ?? "CUSTOM_SMTP").trim().toUpperCase();
  return FE_MAIL_PROVIDERS.includes(p as (typeof FE_MAIL_PROVIDERS)[number]) ? p : "CUSTOM_SMTP";
}

function providerDefaults(provider: string): { host: string; port: number; secure: boolean } | null {
  if (provider === "OUTLOOK") return { host: "smtp.office365.com", port: 587, secure: false };
  if (provider === "GMAIL") return { host: "smtp.gmail.com", port: 587, secure: false };
  return null;
}

function mergeSource(base: FeSmtpSource | null | undefined, overrides?: FeSmtpOverrides): FeSmtpSource {
  const b: FeSmtpSource = base ?? {
    mailProvider: "CUSTOM_SMTP",
    smtpHost: null,
    smtpPort: null,
    smtpSecure: null,
    smtpUser: null,
    smtpPass: null,
    smtpFrom: null,
    correoRemitente: null,
    correoNombre: null,
  };
  if (!overrides) return b;
  return {
    mailProvider: overrides.mailProvider ?? b.mailProvider,
    smtpHost: overrides.smtpHost !== undefined ? overrides.smtpHost : b.smtpHost,
    smtpPort: overrides.smtpPort !== undefined ? overrides.smtpPort : b.smtpPort,
    smtpSecure: overrides.smtpSecure !== undefined ? overrides.smtpSecure : b.smtpSecure,
    smtpUser: overrides.smtpUser !== undefined ? overrides.smtpUser : b.smtpUser,
    smtpFrom: overrides.smtpFrom !== undefined ? overrides.smtpFrom : b.smtpFrom,
    correoRemitente: overrides.correoRemitente !== undefined ? overrides.correoRemitente : b.correoRemitente,
    correoNombre: overrides.correoNombre !== undefined ? overrides.correoNombre : b.correoNombre,
    smtpPass: b.smtpPass,
  };
}

function buildFromHeader(
  r: FeSmtpSource,
  fromOverride?: { email?: string | null; name?: string | null }
): string {
  const fromEmail =
    fromOverride?.email?.trim() ||
    r.smtpFrom?.trim() ||
    r.correoRemitente?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    r.smtpUser?.trim() ||
    "noreply@localhost";
  const fromName = fromOverride?.name?.trim() || r.correoNombre?.trim();
  return fromName ? `"${fromName.replace(/"/g, "")}" <${fromEmail}>` : fromEmail;
}

/** Resuelve SMTP: primero BD (FeEmpresa), luego variables de entorno del servidor. */
export function resolveFeSmtpConfig(
  source?: FeSmtpSource | null,
  overrides?: FeSmtpOverrides,
  fromOverride?: { email?: string | null; name?: string | null }
): MailTransportConfig | null {
  const r = mergeSource(source, overrides);
  const provider = normalizeProvider(r.mailProvider);
  const defaults = providerDefaults(provider);
  const host = r.smtpHost?.trim() || defaults?.host || process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const envPort = Number(process.env.SMTP_PORT ?? "587");
  const port = r.smtpPort ?? defaults?.port ?? (Number.isFinite(envPort) ? envPort : 587);
  const envSecure = process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";
  const secure = r.smtpSecure ?? defaults?.secure ?? envSecure;
  const user = r.smtpUser?.trim() || process.env.SMTP_USER?.trim() || undefined;

  let pass: string | undefined;
  if (overrides && "smtpPass" in overrides && overrides.smtpPass !== undefined) {
    const p = overrides.smtpPass?.trim();
    pass = p && p.length > 0 ? p : r.smtpPass || process.env.SMTP_PASS || undefined;
  } else {
    pass = r.smtpPass || process.env.SMTP_PASS || undefined;
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    from: buildFromHeader(r, fromOverride),
  };
}

export function feSmtpConfigured(source?: FeSmtpSource | null): boolean {
  return resolveFeSmtpConfig(source) !== null;
}
