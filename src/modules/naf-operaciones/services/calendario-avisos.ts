import { prisma } from "@/modules/core/db/prisma";
import { sendPlatformMail } from "@/lib/email/platform-mailer";
import {
  calendarioDaysPending,
  calendarioDigestKind,
  formatCalendarioDay,
  toIsoDate,
  type CalendarioDigestKind,
} from "@/modules/naf-operaciones/business/calendario-types";
import { extendCalendarioSeries } from "@/modules/naf-operaciones/services/calendario-series";
import { todayCostaRica } from "@/modules/documentos-legales/business/dates";
import { dispatchNotificationEvent } from "@/modules/notifications/services/notification-dispatch";
import { seedNotificationCatalog } from "@/modules/notifications/services/notification-preferences";

const APP_BASE =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
  process.env.APP_URL?.replace(/\/$/, "") ||
  "https://alfa.alfaone.local";

const TYPE_ASSIGNED = "nafOperaciones.calendario_assigned";
const TYPE_MONTH_BEFORE = "nafOperaciones.calendario_month_before";
const TYPE_DUE = "nafOperaciones.calendario_due";
const TYPE_REMINDER = "nafOperaciones.calendario_reminder";

type Actor = { id: string; name?: string | null };

type NoticeEvent = {
  id: string;
  title: string;
  date: Date;
  description: string | null;
  status: string;
  monthBeforeOn: Date | null;
  type: { name: string };
  zone: { name: string } | null;
  admins: {
    id: string;
    userId: string;
    assignedNotifiedAt: Date | null;
    lastReminderOn: Date | null;
    monthBeforeSentOn: Date | null;
    user: { id: string; name: string; email: string; isActive: boolean };
  }[];
};

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

function eventUrl(eventId: string): string {
  return `${APP_BASE}/naf-operaciones/calendario?evento=${encodeURIComponent(eventId)}`;
}

function sameDay(a: Date | null, day: Date): boolean {
  return a != null && toIsoDate(a) === toIsoDate(day);
}

async function loadNoticeEvents(eventId: string): Promise<NoticeEvent[]> {
  return prisma.operationalCalendarEvent.findMany({
    where: { id: eventId, status: "SCHEDULED" },
    select: {
      id: true,
      title: true,
      date: true,
      description: true,
      status: true,
      monthBeforeOn: true,
      type: { select: { name: true } },
      zone: { select: { name: true } },
      admins: {
        select: {
          id: true,
          userId: true,
          assignedNotifiedAt: true,
          lastReminderOn: true,
          monthBeforeSentOn: true,
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      },
    },
    take: 1,
  });
}

function detailLines(ev: NoticeEvent, eventDay: string): string {
  const bits = [
    `<li>Tipo: ${escapeHtml(ev.type.name)}</li>`,
    `<li>Fecha: ${escapeHtml(formatCalendarioDay(eventDay))}</li>`,
  ];
  if (ev.zone) bits.push(`<li>Zona: ${escapeHtml(ev.zone.name)}</li>`);
  if (ev.description?.trim()) {
    bits.push(`<li>Detalle: ${escapeHtml(ev.description.trim().slice(0, 500))}</li>`);
  }
  return bits.join("\n");
}

async function sendNotice(input: {
  ev: NoticeEvent;
  user: NoticeEvent["admins"][number]["user"];
  subject: string;
  htmlBody: string;
  text: string;
  typeCode: string;
  title: string;
  body: string;
  actorUserId?: string | null;
}): Promise<{ emailed: boolean; reason?: string }> {
  const url = eventUrl(input.ev.id);
  const html = `<p>Hola ${escapeHtml(input.user.name)},</p>
${input.htmlBody}
<p><a href="${escapeHtml(url)}">Abrir la tarea en el calendario</a></p>`;

  await dispatchNotificationEvent({
    typeCode: input.typeCode,
    title: input.title,
    body: input.body,
    moduleKey: "nafOperaciones",
    entityType: "operationalCalendarEvent",
    entityId: input.ev.id,
    href: `/naf-operaciones/calendario?evento=${encodeURIComponent(input.ev.id)}`,
    recipientUserIds: [input.user.id],
    actorUserId: input.actorUserId,
  }).catch((error) => {
    console.error("[calendario-avisos] campana", error);
  });

  const email = input.user.email?.trim();
  if (!input.user.isActive || !email) {
    return { emailed: false, reason: "sin_correo" };
  }
  const result = await sendPlatformMail({
    to: email,
    subject: input.subject,
    html,
    text: `${input.text} ${url}`,
  });
  return { emailed: result.ok, reason: result.ok ? undefined : result.reason };
}

async function deliverAssignment(ev: NoticeEvent, admin: NoticeEvent["admins"][number], actor?: Actor) {
  const eventDay = toIsoDate(ev.date);
  const today = toIsoDate(todayCostaRica());
  const kind = calendarioDigestKind(eventDay, today);
  const who = actor?.name?.trim();
  const assignedBy = who && actor?.id !== admin.userId ? `${who} te asignó` : "Te asignaron";
  const when =
    kind === "DUE_DAY"
      ? "Es para hoy."
      : kind === "REMINDER"
        ? `La fecha era el ${formatCalendarioDay(eventDay)} y sigue pendiente.`
        : `Es para el ${formatCalendarioDay(eventDay)}. Ese día te avisamos por correo.`;
  const subject =
    kind === "DUE_DAY"
      ? `Te asignaron una tarea para hoy: ${ev.title}`
      : kind === "REMINDER"
        ? `Te asignaron una tarea pendiente: ${ev.title}`
        : `Te asignaron una tarea: ${ev.title}`;
  const follow =
    kind == null
      ? "Un mes antes del cierre te avisamos por correo y en la campana. El día de la tarea también, y si no se marca como realizada, cada día."
      : "Vas a recibir un recordatorio cada día hasta que se marque como realizada.";

  const claimed = await prisma.operationalCalendarEventAdmin.updateMany({
    where: { id: admin.id, assignedNotifiedAt: null },
    data: {
      assignedNotifiedAt: new Date(),
      ...(kind ? { lastReminderOn: todayCostaRica() } : {}),
    },
  });
  if (claimed.count === 0) return false;

  try {
    await sendNotice({
      ev,
      user: admin.user,
      subject,
      title: subject,
      body: `${ev.type.name} · ${formatCalendarioDay(eventDay)}`,
      typeCode: TYPE_ASSIGNED,
      actorUserId: actor?.id,
      htmlBody: `<p>${escapeHtml(assignedBy)} la tarea <strong>${escapeHtml(ev.title)}</strong> en el calendario operativo.</p>
<p>${escapeHtml(when)} ${escapeHtml(follow)}</p>
<ul>
${detailLines(ev, eventDay)}
</ul>`,
      text: `${assignedBy} «${ev.title}». ${when} ${follow}`,
    });
    return true;
  } catch (error) {
    await prisma.operationalCalendarEventAdmin.updateMany({
      where: { id: admin.id },
      data: { assignedNotifiedAt: null, lastReminderOn: null },
    });
    throw error;
  }
}

async function deliverMonthBefore(ev: NoticeEvent, admin: NoticeEvent["admins"][number], today: Date) {
  const eventDay = toIsoDate(ev.date);
  const subject = `Falta un mes: ${ev.title}`;
  const lead = `Falta un mes para el cierre de esta tarea (${formatCalendarioDay(eventDay)}).`;
  const claimed = await prisma.operationalCalendarEventAdmin.updateMany({
    where: { id: admin.id, monthBeforeSentOn: null },
    data: { monthBeforeSentOn: today },
  });
  if (claimed.count === 0) return false;
  try {
    await sendNotice({
      ev,
      user: admin.user,
      subject,
      title: subject,
      body: `${ev.type.name} · cierre ${formatCalendarioDay(eventDay)}`,
      typeCode: TYPE_MONTH_BEFORE,
      htmlBody: `<p>${escapeHtml(lead)} El día del cierre vuelve el aviso y, si no se marca como realizada, el recordatorio diario.</p>
<ul>
${detailLines(ev, eventDay)}
</ul>`,
      text: `${lead} Tarea «${ev.title}».`,
    });
    return true;
  } catch (error) {
    await prisma.operationalCalendarEventAdmin.updateMany({
      where: { id: admin.id, monthBeforeSentOn: today },
      data: { monthBeforeSentOn: null },
    });
    throw error;
  }
}

function monthBeforeIsDue(ev: NoticeEvent, todayIso: string, sentOn: Date | null): boolean {
  if (sentOn) return false;
  if (!ev.monthBeforeOn) return false;
  const eventDay = toIsoDate(ev.date);
  return eventDay > todayIso && toIsoDate(ev.monthBeforeOn) <= todayIso;
}

async function deliverDigest(ev: NoticeEvent, admin: NoticeEvent["admins"][number], kind: CalendarioDigestKind, today: Date) {
  const eventDay = toIsoDate(ev.date);
  const days = calendarioDaysPending(eventDay, toIsoDate(today));
  const isDue = kind === "DUE_DAY";
  const subject = isDue
    ? `Hoy te corresponde: ${ev.title}`
    : `Recordatorio: ${ev.title} sigue pendiente`;
  const lead = isDue
    ? "Hoy es el día de esta tarea."
    : `Sigue pendiente desde el ${formatCalendarioDay(eventDay)} (${days} ${days === 1 ? "día" : "días"}).`;
  const claimed = await prisma.operationalCalendarEventAdmin.updateMany({
    where: {
      id: admin.id,
      OR: [{ lastReminderOn: null }, { lastReminderOn: { lt: today } }],
    },
    data: { lastReminderOn: today },
  });
  if (claimed.count === 0) return false;

  try {
    await sendNotice({
      ev,
      user: admin.user,
      subject,
      title: subject,
      body: `${ev.type.name} · ${formatCalendarioDay(eventDay)}`,
      typeCode: isDue ? TYPE_DUE : TYPE_REMINDER,
      htmlBody: `<p>${escapeHtml(lead)} Cuando la termines, márcala como realizada para dejar de recibir este aviso.</p>
<ul>
${detailLines(ev, eventDay)}
</ul>`,
      text: `${lead} Tarea «${ev.title}». Márcala como realizada para dejar de recibir el aviso.`,
    });
    return true;
  } catch (error) {
    await prisma.operationalCalendarEventAdmin.updateMany({
      where: { id: admin.id, lastReminderOn: today },
      data: { lastReminderOn: admin.lastReminderOn },
    });
    throw error;
  }
}

/**
 * Avisa a los responsables nuevos. Quien guarda la tarea no recibe el «te asignaron»,
 * pero sí el correo del día y los recordatorios.
 * Si la fecha es hoy o ya pasó, el correo de asignación cubre ese día.
 */
export async function notifyCalendarioAssignments(eventId: string, actor?: Actor) {
  await seedNotificationCatalog();
  const [ev] = await loadNoticeEvents(eventId);
  if (!ev) return { assigned: 0 };
  const today = todayCostaRica();
  const todayIso = toIsoDate(today);
  const eventDay = toIsoDate(ev.date);
  let assigned = 0;

  for (const admin of ev.admins) {
    if (!admin.user.isActive) continue;
    if (admin.assignedNotifiedAt) continue;
    if (admin.userId === actor?.id) {
      await prisma.operationalCalendarEventAdmin.updateMany({
        where: { id: admin.id, assignedNotifiedAt: null },
        data: {
          assignedNotifiedAt: new Date(),
          ...(calendarioDigestKind(eventDay, todayIso) ? { lastReminderOn: today } : {}),
        },
      });
    } else if (!admin.assignedNotifiedAt) {
      try {
        if (await deliverAssignment(ev, admin, actor)) assigned += 1;
      } catch (error) {
        console.error("[calendario-avisos] asignación", ev.id, admin.userId, error);
        continue;
      }
    }
    if (!monthBeforeIsDue(ev, todayIso, admin.monthBeforeSentOn)) continue;
    try {
      await deliverMonthBefore(ev, admin, today);
    } catch (error) {
      console.error("[calendario-avisos] mes antes", ev.id, admin.userId, error);
    }
  }
  return { assigned };
}

function asNoticeEvent(
  row: {
    id: string;
    userId: string;
    assignedNotifiedAt: Date | null;
    lastReminderOn: Date | null;
    monthBeforeSentOn: Date | null;
    user: NoticeEvent["admins"][number]["user"];
    event: Omit<NoticeEvent, "admins">;
  },
): { ev: NoticeEvent; admin: NoticeEvent["admins"][number] } {
  const admin = {
    id: row.id,
    userId: row.userId,
    assignedNotifiedAt: row.assignedNotifiedAt,
    lastReminderOn: row.lastReminderOn,
    monthBeforeSentOn: row.monthBeforeSentOn,
    user: row.user,
  };
  return { ev: { ...row.event, admins: [admin] }, admin };
}

/** Correo del día de la tarea y recordatorio diario mientras siga pendiente. */
export async function sendCalendarioDueEmails() {
  await seedNotificationCatalog();
  const today = todayCostaRica();
  const todayIso = toIsoDate(today);
  const seriesExtended = await extendCalendarioSeries(todayIso).catch((error) => {
    console.error("[calendario-avisos] serie", error);
    return 0;
  });
  const rows = await prisma.operationalCalendarEventAdmin.findMany({
    where: {
      user: { isActive: true },
      event: { status: "SCHEDULED" },
      OR: [
        { assignedNotifiedAt: null },
        { lastReminderOn: null, event: { date: { lte: today } } },
        { lastReminderOn: { lt: today }, event: { date: { lte: today } } },
        {
          monthBeforeSentOn: null,
          event: { date: { gt: today }, monthBeforeOn: { lte: today } },
        },
      ],
    },
    orderBy: [{ lastReminderOn: { sort: "asc", nulls: "first" } }, { event: { date: "asc" } }],
    take: 300,
    select: {
      id: true,
      userId: true,
      assignedNotifiedAt: true,
      lastReminderOn: true,
      monthBeforeSentOn: true,
      user: { select: { id: true, name: true, email: true, isActive: true } },
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          description: true,
          status: true,
          monthBeforeOn: true,
          type: { select: { name: true } },
          zone: { select: { name: true } },
        },
      },
    },
  });

  let assigned = 0;
  let monthBefore = 0;
  let due = 0;
  let reminders = 0;
  let skipped = 0;

  for (const row of rows) {
    const { ev, admin } = asNoticeEvent(row);
    const kind = calendarioDigestKind(toIsoDate(ev.date), todayIso);
    let coveredToday = sameDay(admin.lastReminderOn, today);
    try {
      if (!admin.assignedNotifiedAt) {
        if (await deliverAssignment(ev, admin)) {
          assigned += 1;
          if (kind) coveredToday = true;
        }
      }
      if (monthBeforeIsDue(ev, todayIso, admin.monthBeforeSentOn)) {
        if (await deliverMonthBefore(ev, admin, today)) monthBefore += 1;
      }
      if (!kind || coveredToday) continue;
      if (await deliverDigest(ev, admin, kind, today)) {
        if (kind === "DUE_DAY") due += 1;
        else reminders += 1;
      }
    } catch (error) {
      skipped += 1;
      console.error("[calendario-avisos] diario", ev.id, admin.userId, error);
    }
  }

  return {
    assigned,
    monthBefore,
    due,
    reminders,
    skipped,
    seriesExtended,
    queued: rows.length,
    reason: rows.length || seriesExtended ? ("processed" as const) : ("none_due" as const),
  };
}
