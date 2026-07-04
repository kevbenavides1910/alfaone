import { prisma } from "@/modules/core/db/prisma";

export const FACTURACION_COBRO_MAIL_PROVIDERS = ["CUSTOM_SMTP", "OUTLOOK", "GMAIL"] as const;
export type FacturacionCobroMailProvider = (typeof FACTURACION_COBRO_MAIL_PROVIDERS)[number];

export const DEFAULT_FACTURACION_COBRO_SETTINGS = {
  emailSubjectTemplate: "Recordatorio de pago — {{cliente}} — {{numero_factura}}",
  emailBodyTemplate:
    "Estimado/a {{contacto_nombre}}:\n\nPor medio de la presente le recordamos que la factura {{numero_factura}} correspondiente al periodo {{periodo}} por un monto de {{total}} se encuentra pendiente de pago.\n\nFecha de vencimiento: {{fecha_vencimiento}}\nDias vencidos: {{dias_vencidos}}\n\nAgradecemos gestionar el pago a la brevedad posible.\n\nEste mensaje fue enviado automaticamente desde Syntra Dynamics.",
  dueReminderDaysBefore: 7,
  dueReminderSubjectTemplate:
    "Aviso: factura {{numero_factura}} vence en {{dias_hasta_vencimiento}} dias — {{cliente}}",
  dueReminderBodyTemplate:
    "Estimado/a {{contacto_nombre}}:\n\nLe informamos que la factura {{numero_factura}} correspondiente al periodo {{periodo}} por un monto de {{total}} vence el {{fecha_vencimiento}} (faltan {{dias_hasta_vencimiento}} dia(s) para el vencimiento).\n\nAgradecemos adelantar las gestiones de pago correspondientes para evitar retrasos.\n\nEste mensaje fue enviado automaticamente desde Syntra Dynamics.",
  autoDueReminderEnabled: true,
  autoCollectionEnabled: true,
  collectionEmailIntervalDays: 7,
  mailProvider: "CUSTOM_SMTP" as FacturacionCobroMailProvider,
} as const;

export async function ensureFacturacionCobroSettingsRow() {
  return prisma.appFacturacionCobroSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      ...DEFAULT_FACTURACION_COBRO_SETTINGS,
    },
    update: {},
  });
}

export function normalizeFacturacionMailProvider(v: string | null | undefined): FacturacionCobroMailProvider {
  const key = (v ?? "").trim().toUpperCase();
  if (key === "OUTLOOK" || key === "GMAIL" || key === "CUSTOM_SMTP") return key;
  return "CUSTOM_SMTP";
}

export type MailTemplateValues = Record<string, string | number | null | undefined>;

export function renderMailTemplate(template: string, values: MailTemplateValues): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const raw = values[key];
    if (raw === undefined || raw === null) return "";
    return String(raw);
  });
}
