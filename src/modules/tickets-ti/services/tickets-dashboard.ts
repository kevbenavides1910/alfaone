import type { Session } from "next-auth";
import { prisma } from "@/modules/core/db/prisma";
import { ticketsVisibilityWhere } from "./ticket-access";

export async function searchTickets(session: Session, userId: string, q: string, limit = 15) {
  const term = q.trim();
  if (!term) return [];

  const rows = await prisma.ticket.findMany({
    where: {
      deletedAt: null,
      ...ticketsVisibilityWhere(session, userId),
      OR: [
        { ticketNumber: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { requester: { name: { contains: term, mode: "insensitive" } } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    },
    include: {
      category: true,
      status: true,
      priority: true,
      requester: { select: { name: true } },
    },
    orderBy: { lastActivityAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    ticketNumber: r.ticketNumber,
    title: r.title,
    category: r.category.name,
    status: r.status.name,
    statusCode: r.status.code,
    priority: r.priority.name,
    requesterName: r.requester.name,
    href: `/tickets-ti/${r.id}`,
  }));
}

export async function getTicketsDashboard(session: Session, userId: string) {
  const baseWhere = { deletedAt: null, ...ticketsVisibilityWhere(session, userId) };

  const [active, waitingUser, overdueSla, recent] = await Promise.all([
    prisma.ticket.count({
      where: {
        ...baseWhere,
        status: { code: { in: ["NUEVO", "ASIGNADO", "EN_PROCESO", "REABIERTO"] } },
      },
    }),
    prisma.ticket.count({
      where: { ...baseWhere, status: { code: "ESPERANDO_INFORMACION" } },
    }),
    prisma.ticketSla.count({
      where: {
        status: "BREACHED",
        ticket: baseWhere,
      },
    }),
    prisma.ticket.findMany({
      where: {
        ...baseWhere,
        status: { isTerminal: false },
      },
      include: {
        category: true,
        priority: true,
        status: true,
        requester: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        slas: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastActivityAt: "desc" },
      take: 30,
    }),
  ]);

  return {
    counts: { active, waitingUser, overdueSla },
    tickets: recent.map((r) => ({
      id: r.id,
      ticketNumber: r.ticketNumber,
      title: r.title,
      category: r.category.name,
      priorityCode: r.priority.code,
      statusCode: r.status.code,
      statusName: r.status.name,
      requesterName: r.requester.name,
      assigneeName: r.assignedTo?.name ?? null,
      lastActivityAt: r.lastActivityAt.toISOString(),
      slaRemaining: r.slas[0]?.remainingMinutes ?? null,
    })),
  };
}

export async function listUserNotifications(userId: string, limit = 30) {
  const rows = await prisma.ticketNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { ticket: { select: { ticketNumber: true } } },
  });
  return rows.map((n) => ({
    id: n.id,
    ticketId: n.ticketId,
    ticketNumber: n.ticket.ticketNumber,
    title: n.title,
    message: n.message,
    type: n.type,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    href: `/tickets-ti/${n.ticketId}`,
  }));
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.ticketNotification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.ticketNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function countUnreadNotifications(userId: string) {
  return prisma.ticketNotification.count({ where: { userId, readAt: null } });
}
