import type { Prisma } from "@prisma/client";

type AuditInput = {
  ticketId?: string | null;
  userId?: string | null;
  action: string;
  tableName?: string;
  recordId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ip?: string | null;
  browser?: string | null;
  device?: string | null;
};

export async function writeTicketAudit(
  tx: Prisma.TransactionClient,
  input: AuditInput
) {
  await tx.ticketAudit.create({
    data: {
      ticketId: input.ticketId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      tableName: input.tableName ?? null,
      recordId: input.recordId ?? null,
      oldValues: input.oldValues != null ? (input.oldValues as Prisma.InputJsonValue) : undefined,
      newValues: input.newValues != null ? (input.newValues as Prisma.InputJsonValue) : undefined,
      ip: input.ip ?? null,
      browser: input.browser ?? null,
      device: input.device ?? null,
    },
  });
}
