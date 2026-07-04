import type { Prisma, SigAuditAction } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

export async function writeSigAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    documentId: string;
    versionId?: string | null;
    action: SigAuditAction;
    actorId: string;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) {
  return tx.sigDocumentAuditLog.create({
    data: {
      documentId: input.documentId,
      versionId: input.versionId ?? null,
      action: input.action,
      actorId: input.actorId,
      notes: input.notes?.trim().slice(0, 4000) ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
