import { prisma } from "@/modules/core/db/prisma";
import { sendPlatformMail } from "@/lib/email/platform-mailer";
import { listSigRevisionReminders } from "./revision-reminders";

const APP_BASE =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
  process.env.APP_URL?.replace(/\/$/, "") ||
  "https://localhost:3000";

/** Envía correos de vigencia a creadores y aprobadores de versiones vigentes. */
export async function sendSigRevisionReminderEmails(withinDays = 30) {
  const reminders = await listSigRevisionReminders(withinDays);
  if (!reminders.length) {
    return { sent: 0, skipped: 0, total: 0, reason: "none_due" as const };
  }

  const docs = await prisma.sigDocument.findMany({
    where: { id: { in: reminders.map((r) => r.documentId) } },
    select: {
      id: true,
      code: true,
      title: true,
      createdBy: { select: { email: true, name: true } },
      currentVersion: {
        select: {
          assignedApprover: { select: { email: true, name: true } },
          approvedBy: { select: { email: true, name: true } },
        },
      },
    },
  });

  const byId = new Map(docs.map((d) => [d.id, d]));
  const byEmail = new Map<
    string,
    { name: string; items: typeof reminders }
  >();

  for (const rem of reminders) {
    const doc = byId.get(rem.documentId);
    if (!doc) continue;
    const recipients = [
      doc.createdBy,
      doc.currentVersion?.assignedApprover,
      doc.currentVersion?.approvedBy,
    ].filter(Boolean) as { email: string; name: string }[];

    const seen = new Set<string>();
    for (const u of recipients) {
      const email = u.email?.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const bucket = byEmail.get(email) ?? { name: u.name, items: [] };
      bucket.items.push(rem);
      byEmail.set(email, bucket);
    }
  }

  let sent = 0;
  let skipped = 0;

  for (const [email, { name, items }] of byEmail) {
    const overdue = items.filter((i) => i.isOverdue);
    const upcoming = items.filter((i) => !i.isOverdue);
    const rows = items
      .map((i) => {
        const due = new Date(i.nextRevisionDue).toLocaleDateString("es-CR");
        const flag = i.isOverdue ? "VENCIDO" : `${i.daysUntilDue} d`;
        const url = `${APP_BASE}/sig/documentos/${i.documentId}`;
        return `<tr>
          <td style="padding:6px;border:1px solid #ddd">${i.code}</td>
          <td style="padding:6px;border:1px solid #ddd">${i.title}</td>
          <td style="padding:6px;border:1px solid #ddd">${due}</td>
          <td style="padding:6px;border:1px solid #ddd">${flag}</td>
          <td style="padding:6px;border:1px solid #ddd"><a href="${url}">Abrir</a></td>
        </tr>`;
      })
      .join("");

    const subject =
      overdue.length > 0
        ? `[SIG] ${overdue.length} documento(s) con revisión vencida`
        : `[SIG] ${upcoming.length} documento(s) por revisar (${withinDays} días)`;

    const html = `
      <p>Hola ${name || ""},</p>
      <p>Estos documentos del SIG requieren atención de vigencia/revisión:</p>
      <table style="border-collapse:collapse;font-size:14px">
        <thead>
          <tr>
            <th style="padding:6px;border:1px solid #ddd;text-align:left">Código</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left">Título</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left">Próxima revisión</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left">Estado</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p><a href="${APP_BASE}/sig/vigencias">Ver todas las vigencias</a></p>
    `;

    const result = await sendPlatformMail({ to: email, subject, html });
    if (result.ok) sent += 1;
    else skipped += 1;
  }

  return { sent, skipped, total: reminders.length, recipients: byEmail.size };
}
