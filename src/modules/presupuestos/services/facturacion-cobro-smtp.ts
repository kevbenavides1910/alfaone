import nodemailer from "nodemailer";
import {
  ensureFacturacionCobroSettingsRow,
  normalizeFacturacionMailProvider,
} from "@/modules/presupuestos/services/facturacion-cobro-settings";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

export type FacturacionCobroSmtpSource = {
  mailProvider: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
};

export type FacturacionCobroSmtpOverrides = Partial<{
  mailProvider: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPass: string | undefined;
  smtpFrom: string | null;
}>;

function providerDefaults(provider: string): { host: string; port: number; secure: boolean } | null {
  const p = normalizeFacturacionMailProvider(provider);
  if (p === "OUTLOOK") return { host: "smtp.office365.com", port: 587, secure: false };
  if (p === "GMAIL") return { host: "smtp.gmail.com", port: 587, secure: false };
  return null;
}

function mergeSource(
  base: FacturacionCobroSmtpSource,
  o?: FacturacionCobroSmtpOverrides
): FacturacionCobroSmtpSource {
  if (!o) return base;
  return {
    mailProvider: o.mailProvider !== undefined ? o.mailProvider : base.mailProvider,
    smtpHost: o.smtpHost !== undefined ? o.smtpHost : base.smtpHost,
    smtpPort: o.smtpPort !== undefined ? o.smtpPort : base.smtpPort,
    smtpSecure: o.smtpSecure !== undefined ? o.smtpSecure : base.smtpSecure,
    smtpUser: o.smtpUser !== undefined ? o.smtpUser : base.smtpUser,
    smtpFrom: o.smtpFrom !== undefined ? o.smtpFrom : base.smtpFrom,
    smtpPass: base.smtpPass,
  };
}

export function resolveFacturacionCobroSmtpConfig(
  row: FacturacionCobroSmtpSource,
  overrides?: FacturacionCobroSmtpOverrides
): SmtpConfig | null {
  const r = mergeSource(row, overrides);
  const defaults = providerDefaults(r.mailProvider);
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
    pass = p && p.length > 0 ? p : row.smtpPass || process.env.SMTP_PASS || undefined;
  } else {
    pass = row.smtpPass || process.env.SMTP_PASS || undefined;
  }

  const from = r.smtpFrom?.trim() || process.env.SMTP_FROM?.trim() || user || "noreply@localhost";
  return { host, port, secure, user, pass, from };
}

export async function getFacturacionCobroSmtpConfig(): Promise<SmtpConfig | null> {
  const row = await ensureFacturacionCobroSettingsRow();
  return resolveFacturacionCobroSmtpConfig(row);
}

export function createTransportFromConfig(c: SmtpConfig) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user && c.pass ? { user: c.user, pass: c.pass } : undefined,
  });
}

export async function assertFacturacionCobroSmtpReady(): Promise<SmtpConfig> {
  const cfg = await getFacturacionCobroSmtpConfig();
  if (!cfg) {
    throw new Error(
      "No hay servidor SMTP guardado. Configure y guarde Facturación → Configuración de correo antes de enviar."
    );
  }
  if (cfg.user && !cfg.pass) {
    throw new Error(
      "Falta contraseña SMTP guardada. Guarde la configuración de correo con contraseña en Facturación → Configuración."
    );
  }
  return cfg;
}
