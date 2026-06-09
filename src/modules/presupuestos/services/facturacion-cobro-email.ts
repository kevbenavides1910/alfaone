import type { Transporter } from "nodemailer";
import { prisma } from "@/modules/core/db/prisma";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { daysUntilDue } from "@/lib/utils/due-date-urgency";
import { mergeDisciplinaryCc } from "@/modules/disciplinario/services/disciplinary-email";
import {
  ensureFacturacionCobroSettingsRow,
  renderMailTemplate,
} from "@/modules/presupuestos/services/facturacion-cobro-settings";
import {
  assertFacturacionCobroSmtpReady,
  createTransportFromConfig,
} from "@/modules/presupuestos/services/facturacion-cobro-smtp";
import { pickBillingContact } from "@/modules/presupuestos/services/cuentas-por-cobrar";

export type CobroEmailKind = "collection" | "due_reminder";

export type CobroEmailTemplateOverrides = {
  emailSubjectTemplate?: string | null;
  emailBodyTemplate?: string | null;
  emailFixedCc?: string | null;
  dueReminderSubjectTemplate?: string | null;
  dueReminderBodyTemplate?: string | null;
};

export function buildCobroEmailTemplateValues(opts: {
  contactoNombre: string;
  cliente: string;
  licitacion: string;
  periodo: string;
  numeroFactura: string;
  total: number | null;
  dueDate: Date;
}): Record<string, string> {
  const days = daysUntilDue(opts.dueDate);
  const diasVencidos = days < 0 ? String(-days) : "0";
  const diasHastaVencimiento = days > 0 ? String(days) : "0";

  return {
    contacto_nombre: opts.contactoNombre,
    cliente: opts.cliente,
    licitacion: opts.licitacion,
    periodo: opts.periodo,
    numero_factura: opts.numeroFactura,
    total: opts.total != null ? formatCurrency(opts.total) : "—",
    fecha_vencimiento: formatDate(opts.dueDate),
    dias_vencidos: diasVencidos,
    dias_hasta_vencimiento: diasHastaVencimiento,
  };
}

export function buildCobroEmailContent(
  settings: Awaited<ReturnType<typeof ensureFacturacionCobroSettingsRow>>,
  values: Record<string, string>,
  kind: CobroEmailKind,
  overrides?: CobroEmailTemplateOverrides
) {
  const subjectTpl =
    kind === "due_reminder"
      ? overrides?.dueReminderSubjectTemplate?.trim() || settings.dueReminderSubjectTemplate
      : overrides?.emailSubjectTemplate?.trim() || settings.emailSubjectTemplate;
  const bodyTpl =
    kind === "due_reminder"
      ? overrides?.dueReminderBodyTemplate?.trim() || settings.dueReminderBodyTemplate
      : overrides?.emailBodyTemplate?.trim() || settings.emailBodyTemplate;
  return {
    subject: renderMailTemplate(subjectTpl, values),
    text: renderMailTemplate(bodyTpl, values),
  };
}

export async function sendCobroCollectionEmail(opts: {
  transport: Transporter;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  text: string;
}): Promise<void> {
  await opts.transport.sendMail({
    from: opts.from,
    to: opts.to,
    ...(opts.cc ? { cc: opts.cc } : {}),
    subject: opts.subject,
    text: opts.text,
  });
}

export type SendCobroEmailResult =
  | { ok: true; sentTo: string; cc: string | null }
  | {
      ok: false;
      code: "NOT_FOUND" | "NO_CONTACT" | "INVALID_STATUS" | "NOT_DUE_YET" | "ALREADY_OVERDUE" | "SMTP";
      message: string;
    };

async function loadCxcDocumentoForEmail(documentoId: string) {
  return prisma.cxcDocumento.findUnique({
    where: { id: documentoId },
    include: {
      contract: {
        select: {
          licitacionNo: true,
          clientContacts: {
            orderBy: { sortOrder: "asc" },
            select: {
              name: true,
              jobTitle: true,
              phone: true,
              phone2: true,
              email: true,
              isBillingContact: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });
}

export async function sendCollectionEmailForFactura(
  documentoId: string,
  kind: CobroEmailKind = "collection",
  overrides?: CobroEmailTemplateOverrides
): Promise<SendCobroEmailResult> {
  const doc = await loadCxcDocumentoForEmail(documentoId);

  if (!doc) {
    return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  }

  if (doc.status !== "PENDIENTE" || Number(doc.saldo) <= 0) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Solo se pueden enviar correos a documentos pendientes de cobro",
    };
  }

  if (!doc.dueDate) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "El documento no tiene fecha de vencimiento",
    };
  }

  const daysLeft = daysUntilDue(doc.dueDate);
  if (kind === "due_reminder" && daysLeft <= 0) {
    return {
      ok: false,
      code: "ALREADY_OVERDUE",
      message: "El documento ya venció. Use el correo de cobro por vencimiento.",
    };
  }
  if (kind === "collection" && daysLeft > 0) {
    return {
      ok: false,
      code: "NOT_DUE_YET",
      message: "El documento aún no vence. Use el recordatorio por vencer.",
    };
  }

  const billingContact = pickBillingContact(doc.contract?.clientContacts ?? []);
  if (!billingContact?.email?.trim()) {
    return {
      ok: false,
      code: "NO_CONTACT",
      message: "El contrato no tiene contacto de facturación con correo electrónico",
    };
  }

  let smtp;
  try {
    smtp = await assertFacturacionCobroSmtpReady();
  } catch (e) {
    return {
      ok: false,
      code: "SMTP",
      message: e instanceof Error ? e.message : "Error de configuración SMTP",
    };
  }

  const settings = await ensureFacturacionCobroSettingsRow();
  const to = billingContact.email.trim();
  const fixedCc =
    overrides?.emailFixedCc !== undefined
      ? overrides.emailFixedCc?.trim() || null
      : settings.emailFixedCc;
  const cc = mergeDisciplinaryCc(to, fixedCc) ?? null;

  const periodRef = doc.servicePeriodDate ?? doc.documentDate ?? new Date();
  const values = buildCobroEmailTemplateValues({
    contactoNombre: billingContact.name,
    cliente: doc.clientName,
    licitacion: doc.contract?.licitacionNo ?? "",
    periodo: `${periodRef.getUTCMonth() + 1}/${periodRef.getUTCFullYear()}`,
    numeroFactura: doc.invoiceNumber?.trim() || doc.documentNumber,
    total: doc.montoOriginal != null ? Number(doc.montoOriginal) : Number(doc.saldo),
    dueDate: doc.dueDate,
  });

  const { subject, text } = buildCobroEmailContent(settings, values, kind, overrides);
  const transport = createTransportFromConfig(smtp);

  try {
    await sendCobroCollectionEmail({
      transport,
      from: smtp.from,
      to,
      cc: cc ?? undefined,
      subject,
      text,
    });
  } catch (e) {
    return {
      ok: false,
      code: "SMTP",
      message: e instanceof Error ? e.message : "Error al enviar correo",
    };
  }

  const now = new Date();
  await prisma.cxcDocumento.update({
    where: { id: documentoId },
    data:
      kind === "due_reminder"
        ? { lastDueReminderEmailAt: now }
        : { lastCollectionEmailAt: now, collectionEmailCount: { increment: 1 } },
  });

  return { ok: true, sentTo: to, cc };
}

export function sampleCobroTemplateValues(kind: CobroEmailKind): Record<string, string> {
  const due = new Date();
  if (kind === "due_reminder") {
    due.setDate(due.getDate() + 5);
  } else {
    due.setDate(due.getDate() - 5);
  }
  return buildCobroEmailTemplateValues({
    contactoNombre: "María Ejemplo",
    cliente: "Cliente de prueba S.A.",
    licitacion: "LIC-2026-001",
    periodo: "5/2026",
    numeroFactura: "FE-000123",
    total: 1250000,
    dueDate: due,
  });
}
