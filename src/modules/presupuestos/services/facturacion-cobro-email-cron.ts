import { prisma } from "@/modules/core/db/prisma";
import { daysUntilDue } from "@/lib/utils/due-date-urgency";
import { pickBillingContact } from "@/modules/presupuestos/services/cuentas-por-cobrar";
import { ensureFacturacionCobroSettingsRow } from "@/modules/presupuestos/services/facturacion-cobro-settings";
import { sendCollectionEmailForFactura } from "@/modules/presupuestos/services/facturacion-cobro-email";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return startOfLocalDay(a).getTime() === startOfLocalDay(b).getTime();
}

function daysBetweenLocal(a: Date, b: Date): number {
  const ms = startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Máximo un recordatorio por vencer por factura y por día calendario. */
export function shouldSendAutoDueReminder(
  lastSent: Date | null | undefined,
  daysLeft: number,
  windowDays: number,
  asOf: Date
): boolean {
  if (daysLeft <= 0 || daysLeft > windowDays) return false;
  if (!lastSent) return true;
  return !isSameLocalDay(lastSent, asOf);
}

/**
 * Cobro automático: desde el día de vencimiento (0) o después;
 * reenvío cada N días desde el último envío de cobro.
 */
export function shouldSendAutoCollection(
  lastSent: Date | null | undefined,
  daysLeft: number,
  intervalDays: number,
  asOf: Date
): boolean {
  if (daysLeft > 0) return false;
  if (!lastSent) return true;
  return daysBetweenLocal(lastSent, asOf) >= intervalDays;
}

export type AutoCobroEmailFailure = {
  facturaId: string;
  kind: "due_reminder" | "collection";
  message: string;
};

export type AutoCobroEmailRunResult = {
  ranAt: string;
  dueReminder: { sent: number; skipped: number; failed: AutoCobroEmailFailure[] };
  collection: { sent: number; skipped: number; failed: AutoCobroEmailFailure[] };
  disabled: { dueReminder: boolean; collection: boolean };
};

export async function runAutomaticCobroEmails(asOf: Date = new Date()): Promise<AutoCobroEmailRunResult> {
  const settings = await ensureFacturacionCobroSettingsRow();
  const result: AutoCobroEmailRunResult = {
    ranAt: asOf.toISOString(),
    dueReminder: { sent: 0, skipped: 0, failed: [] },
    collection: { sent: 0, skipped: 0, failed: [] },
    disabled: {
      dueReminder: !settings.autoDueReminderEnabled,
      collection: !settings.autoCollectionEnabled,
    },
  };

  if (!settings.autoDueReminderEnabled && !settings.autoCollectionEnabled) {
    return result;
  }

  const documentos = await prisma.cxcDocumento.findMany({
    where: {
      status: "PENDIENTE",
      isReajuste: false,
      docType: { in: ["FC", "FM"] },
      saldo: { gt: 0 },
      dueDate: { not: null },
      contractId: { not: null },
    },
    select: {
      id: true,
      dueDate: true,
      lastDueReminderEmailAt: true,
      lastCollectionEmailAt: true,
      contract: {
        select: {
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

  for (const factura of documentos) {
    if (!factura.dueDate) continue;
    const contact = pickBillingContact(factura.contract?.clientContacts ?? []);
    if (!contact?.email?.trim()) {
      if (settings.autoDueReminderEnabled) result.dueReminder.skipped += 1;
      if (settings.autoCollectionEnabled) result.collection.skipped += 1;
      continue;
    }

    const daysLeft = daysUntilDue(factura.dueDate!, asOf);

    if (settings.autoDueReminderEnabled) {
      if (
        shouldSendAutoDueReminder(
          factura.lastDueReminderEmailAt,
          daysLeft,
          settings.dueReminderDaysBefore,
          asOf
        )
      ) {
        const send = await sendCollectionEmailForFactura(factura.id, "due_reminder");
        if (send.ok) {
          result.dueReminder.sent += 1;
        } else {
          result.dueReminder.failed.push({
            facturaId: factura.id,
            kind: "due_reminder",
            message: send.message,
          });
        }
      } else {
        result.dueReminder.skipped += 1;
      }
    }

    if (settings.autoCollectionEnabled) {
      if (
        shouldSendAutoCollection(
          factura.lastCollectionEmailAt,
          daysLeft,
          settings.collectionEmailIntervalDays,
          asOf
        )
      ) {
        const send = await sendCollectionEmailForFactura(factura.id, "collection");
        if (send.ok) {
          result.collection.sent += 1;
        } else {
          result.collection.failed.push({
            facturaId: factura.id,
            kind: "collection",
            message: send.message,
          });
        }
      } else {
        result.collection.skipped += 1;
      }
    }
  }

  await prisma.appFacturacionCobroSettings.update({
    where: { id: "default" },
    data: { lastAutoEmailRunAt: asOf },
  });

  return result;
}
