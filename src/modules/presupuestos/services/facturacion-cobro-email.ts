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

function toAmount(v: { toString(): string } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : parseFloat(v.toString());
}

function resolveCxcDueDate(doc: {
  dueDate: Date | null;
  cxcExpectedPaymentDate: Date | null;
  documentDate: Date | null;
}): Date | null {
  return doc.dueDate ?? doc.cxcExpectedPaymentDate ?? doc.documentDate;
}

function periodLabel(doc: {
  servicePeriodDate: Date | null;
  documentDate: Date | null;
  facturaMensual: { periodMonth: number; periodYear: number } | null;
}): string {
  if (doc.facturaMensual) {
    return `${doc.facturaMensual.periodMonth}/${doc.facturaMensual.periodYear}`;
  }
  const ref = doc.servicePeriodDate ?? doc.documentDate;
  if (!ref) return "—";
  return `${ref.getUTCMonth() + 1}/${ref.getUTCFullYear()}`;
}

const cxcEmailInclude = {
  contract: {
    select: {
      licitacionNo: true,
      clientContacts: {
        orderBy: { sortOrder: "asc" as const },
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
  facturaMensual: {
    select: { periodMonth: true, periodYear: true },
  },
};

async function loadCxcForEmail(documentoId: string) {
  return prisma.cxcDocumento.findUnique({
    where: { id: documentoId },
    include: cxcEmailInclude,
  });
}

export async function sendCollectionEmailForCxcDocumento(
  documentoId: string,
  kind: CobroEmailKind = "collection",
  overrides?: CobroEmailTemplateOverrides
): Promise<SendCobroEmailResult> {
  const doc = await loadCxcForEmail(documentoId);

  if (!doc) {
    return { ok: false, code: "NOT_FOUND", message: "Documento de cuentas por cobrar no encontrado" };
  }

  const saldo = toAmount(doc.saldo) ?? 0;
  if (doc.status !== "PENDIENTE" || saldo <= 0) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Solo se envían correos a documentos pendientes de cobro en cuentas por cobrar",
    };
  }

  const dueDate = resolveCxcDueDate(doc);
  if (!dueDate) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "El documento no tiene fecha de vencimiento",
    };
  }

  const daysLeft = daysUntilDue(dueDate);
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

  const values = buildCobroEmailTemplateValues({
    contactoNombre: billingContact.name,
    cliente: doc.clientName,
    licitacion: doc.contract?.licitacionNo ?? "",
    periodo: periodLabel(doc),
    numeroFactura: doc.invoiceNumber?.trim() || doc.documentNumber || "—",
    total: toAmount(doc.montoOriginal) ?? saldo,
    dueDate,
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
  const emailStamp =
    kind === "due_reminder"
      ? { lastDueReminderEmailAt: now }
      : { lastCollectionEmailAt: now, collectionEmailCount: { increment: 1 as const } };

  await prisma.cxcDocumento.update({
    where: { id: documentoId },
    data: emailStamp,
  });
  if (doc.facturaMensualId) {
    await prisma.facturaMensual.update({
      where: { id: doc.facturaMensualId },
      data: emailStamp,
    });
  }

  return { ok: true, sentTo: to, cc };
}

/** Compat: busca el CxC ligado y envía según estado de cuentas por cobrar. */
export async function sendCollectionEmailForFactura(
  facturaId: string,
  kind: CobroEmailKind = "collection",
  overrides?: CobroEmailTemplateOverrides
): Promise<SendCobroEmailResult> {
  const cxc = await prisma.cxcDocumento.findFirst({
    where: { facturaMensualId: facturaId, docType: { in: ["FC", "FM"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!cxc) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "No hay documento de cuentas por cobrar para esta factura",
    };
  }
  return sendCollectionEmailForCxcDocumento(cxc.id, kind, overrides);
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
