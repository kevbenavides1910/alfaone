import type { Prisma } from "@prisma/client";
import { dispatchNotificationEvent } from "@/modules/notifications/services/notification-dispatch";

const TICKET_TYPE_MAP: Record<string, string> = {
  created: "tickets.created",
  assigned: "tickets.assigned",
  updated: "tickets.updated",
  status: "tickets.status_changed",
  priority: "tickets.priority_changed",
  comment: "tickets.comment",
  attachment: "tickets.attachment",
  reopened: "tickets.reopened",
  closed: "tickets.closed",
};

export async function notifyTicketUsers(
  tx: Prisma.TransactionClient,
  input: {
    ticketId: string;
    userIds: string[];
    title: string;
    message: string;
    type: string;
  }
) {
  const unique = [...new Set(input.userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await tx.ticketNotification.createMany({
    data: unique.map((userId) => ({
      ticketId: input.ticketId,
      userId,
      title: input.title,
      message: input.message,
      type: input.type,
    })),
  });

  const typeCode = TICKET_TYPE_MAP[input.type] ?? "tickets.updated";
  await dispatchNotificationEvent(
    {
      typeCode,
      title: input.title,
      body: input.message,
      moduleKey: "ticketsTi",
      entityType: "ticket",
      entityId: input.ticketId,
      href: `/tickets-ti/${input.ticketId}`,
      recipientUserIds: unique,
    },
    tx,
  );
}
