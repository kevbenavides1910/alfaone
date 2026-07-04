import type { Prisma } from "@prisma/client";

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
}
