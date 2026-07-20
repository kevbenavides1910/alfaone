import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

export async function writeNotificationAudit(
  input: {
    notificationId?: string | null;
    action: string;
    userId?: string | null;
    recipientId?: string | null;
    moduleKey?: string | null;
    actorIp?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  await db.notificationAuditLog.create({
    data: {
      notificationId: input.notificationId,
      action: input.action,
      userId: input.userId,
      recipientId: input.recipientId,
      moduleKey: input.moduleKey,
      actorIp: input.actorIp,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
