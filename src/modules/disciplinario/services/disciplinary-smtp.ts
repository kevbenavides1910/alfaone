import { createMailTransport, type MailTransportConfig } from "@/lib/email/nodemailer-transport";
import { ensureDisciplinarySettingsRow, normalizeMailProvider } from "@/modules/disciplinario/services/disciplinary-settings";

export type SmtpConfig = MailTransportConfig;

/** Fila mínima para armar SMTP (BD o borrador de prueba). */
export type DisciplinarySmtpSource = {
  mailProvider: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string | null;
};

export type DisciplinarySmtpOverrides = Partial<{
  mailProvider: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  /** Si viene vacío o ausente, se usa el guardado en BD / env. */
  smtpPass: string | undefined;
  smtpFrom: string | null;
}>;

function providerDefaults(provider: string): { host: string; port: number; secure: boolean } | null {
  const p = normalizeMailProvider(provider);
  if (p === "OUTLOOK") return { host: "smtp.office365.com", port: 587, secure: false };
  if (p === "GMAIL") return { host: "smtp.gmail.com", port: 587, secure: false };
  return null;
}

function mergeSource(base: DisciplinarySmtpSource, o?: DisciplinarySmtpOverrides): DisciplinarySmtpSource {
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

/**
 * Arma configuración SMTP a partir de fila BD (y opcionalmente borrador del formulario).
 * `smtpPass` en overrides: si es string no vacío, sustituye; si no se envía el campo, usa BD/env.
 */
export function resolveSmtpConfig(
  row: DisciplinarySmtpSource,
  overrides?: DisciplinarySmtpOverrides,
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
  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

/** SMTP opcional: si no hay host final, no se envían correos. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const row = await ensureDisciplinarySettingsRow();
  return resolveSmtpConfig(row);
}

export function createTransportFromConfig(c: SmtpConfig) {
  return createMailTransport(c);
}

export async function createSmtpTransport() {
  const c = await getSmtpConfig();
  if (!c) return null;
  return createTransportFromConfig(c);
}

/** Lanza error claro si falta SMTP guardado (importación / reenvío de correos). */
export async function assertDisciplinarySmtpReady(): Promise<SmtpConfig> {
  const cfg = await getSmtpConfig();
  if (!cfg) {
    throw new Error(
      "No hay servidor SMTP guardado. Configure y guarde Disciplinario → Ajustes → Configuración antes de enviar correos.",
    );
  }
  if (cfg.user && !cfg.pass) {
    throw new Error(
      "Falta contraseña SMTP guardada. Guarde la configuración de correo con contraseña en Disciplinario → Ajustes → Configuración.",
    );
  }
  return cfg;
}
