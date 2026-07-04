import type { Prisma } from "@prisma/client";

export async function writeTicketHistory(
  tx: Prisma.TransactionClient,
  input: {
    ticketId: string;
    changedById: string;
    field: string;
    oldValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
  }
) {
  await tx.ticketHistory.create({
    data: {
      ticketId: input.ticketId,
      changedById: input.changedById,
      field: input.field,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      reason: input.reason ?? null,
    },
  });
}
