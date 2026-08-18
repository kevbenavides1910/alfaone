import { prisma } from "@/modules/core/db/prisma";

export type FingerAuditInput = {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  result?: string;
  message?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logFingerOperation(input: FingerAuditInput) {
  return prisma.fingerOperationLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      result: input.result ?? "success",
      message: input.message ?? null,
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}
