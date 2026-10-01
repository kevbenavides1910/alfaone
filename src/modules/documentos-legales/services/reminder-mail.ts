import { prisma } from "@/modules/core/db/prisma";
import { sendPlatformMail } from "@/lib/email/platform-mailer";
import { legalDocumentTypeLabel } from "../business/catalog";
import { todayCostaRica, toIsoDay } from "../business/dates";
import { formatReminderOffset } from "../business/reminders";

const APP_BASE =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
  process.env.APP_URL?.replace(/\/$/, "") ||
  "https://alfa.alfaone.local";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

/** Envía avisos con sendOn <= hoy, documento impago y sentAt nulo. */
export async function sendLegalDocumentReminderEmails() {
  const today = todayCostaRica();
  const due = await prisma.legalDocumentReminder.findMany({
    where: {
      sentAt: null,
      sendOn: { lte: today },
      legalDocument: { paid: false },
    },
    include: {
      legalDocument: {
        include: {
          responsibleUser: { select: { name: true, email: true, isActive: true } },
        },
      },
    },
    orderBy: { sendOn: "asc" },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;

  for (const reminder of due) {
    const doc = reminder.legalDocument;
    const email = doc.responsibleUser.email?.trim();
    if (!doc.responsibleUser.isActive || !email) {
      skipped += 1;
      await prisma.legalDocumentReminder.updateMany({
        where: { id: reminder.id, sentAt: null },
        data: { lastError: "El responsable no tiene correo o está inactivo" },
      });
      continue;
    }

    const typeLabel = legalDocumentTypeLabel(doc.type, doc.otherTypeLabel);
    const dueLabel = toIsoDay(doc.dueDate);
    const when = formatReminderOffset(reminder);
    const url = `${APP_BASE}/documentos-legales`;
    const subject = `Recordatorio: ${typeLabel} — ${doc.description}`;
    const html = `<p>Hola ${escapeHtml(doc.responsibleUser.name)},</p>
<p>Tenés un vencimiento de <strong>${escapeHtml(typeLabel)}</strong> (${escapeHtml(when)}).</p>
<ul>
  <li>Descripción: ${escapeHtml(doc.description)}</li>
  <li>Vigencia: ${escapeHtml(dueLabel)}</li>
  <li>Monto: ${escapeHtml(Number(doc.amount.toString()).toFixed(2))}</li>
  ${doc.company ? `<li>Empresa: ${escapeHtml(doc.company)}</li>` : ""}
  ${doc.referenceNumber ? `<li>Referencia: ${escapeHtml(doc.referenceNumber)}</li>` : ""}
</ul>
<p><a href="${escapeHtml(url)}">Abrir documentos legales</a></p>`;

    try {
      const result = await sendPlatformMail({
        to: email,
        subject,
        html,
        text: `${typeLabel}: ${doc.description}. Vence ${dueLabel} (${when}). ${url}`,
      });
      if (!result.ok) {
        skipped += 1;
        await prisma.legalDocumentReminder.updateMany({
          where: { id: reminder.id, sentAt: null },
          data: { lastError: result.reason || "No se pudo enviar el correo" },
        });
        continue;
      }
      const marked = await prisma.legalDocumentReminder.updateMany({
        where: { id: reminder.id, sentAt: null, legalDocument: { paid: false } },
        data: { sentAt: new Date(), lastError: null },
      });
      if (marked.count > 0) sent += 1;
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : "Error al enviar el correo";
      await prisma.legalDocumentReminder
        .updateMany({
          where: { id: reminder.id, sentAt: null },
          data: { lastError: message.slice(0, 500) },
        })
        .catch(() => undefined);
    }
  }

  return {
    sent,
    skipped,
    total: due.length,
    reason: due.length ? ("processed" as const) : ("none_due" as const),
  };
}
