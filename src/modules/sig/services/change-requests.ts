import type { SigChangeRequestStatus, SigChangeRequestType } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { writeSigAuditLog } from "./audit-log";

export type CreateChangeRequestInput = {
  type?: SigChangeRequestType;
  description: string;
  targetStageId?: string | null;
  proposedTitle?: string | null;
  proposedBody?: string | null;
};

const changeRequestInclude = {
  requester: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
  targetStage: { select: { id: true, title: true, sortOrder: true } },
} as const;

export async function listSigChangeRequests(
  documentId: string,
  opts?: { status?: SigChangeRequestStatus | "ALL" }
) {
  const status = opts?.status && opts.status !== "ALL" ? opts.status : undefined;
  return prisma.sigChangeRequest.findMany({
    where: {
      documentId,
      ...(status ? { status } : {}),
    },
    include: changeRequestInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function createSigChangeRequest(
  documentId: string,
  requesterId: string,
  input: CreateChangeRequestInput
) {
  const description = input.description?.trim();
  if (!description) throw new Error("Describa el cambio solicitado");

  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    select: { id: true, status: true, currentVersionId: true },
  });
  if (!doc) throw new Error("Documento no encontrado");
  if (doc.status === "OBSOLETE") throw new Error("El documento está obsoleto");

  if (input.targetStageId) {
    const stage = await prisma.sigProcedureStage.findFirst({
      where: {
        id: input.targetStageId,
        versionId: doc.currentVersionId ?? undefined,
      },
    });
    if (!stage) throw new Error("La etapa indicada no pertenece a la versión vigente");
  }

  const type = input.type ?? "GENERAL";

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.sigChangeRequest.create({
      data: {
        documentId,
        requesterId,
        type,
        description: description.slice(0, 8000),
        targetStageId: input.targetStageId || null,
        proposedTitle: input.proposedTitle?.trim().slice(0, 300) || null,
        proposedBody: input.proposedBody?.trim().slice(0, 20000) || null,
        status: "OPEN",
      },
      include: changeRequestInclude,
    });

    await writeSigAuditLog(tx, {
      documentId,
      versionId: doc.currentVersionId,
      action: "CHANGE_REQUESTED",
      actorId: requesterId,
      notes: description.slice(0, 500),
      metadata: { changeRequestId: row.id, type },
    });

    return row;
  });

  return created;
}

export async function reviewSigChangeRequest(
  documentId: string,
  requestId: string,
  reviewerId: string,
  action: "ACCEPT" | "REJECT" | "CANCEL",
  reviewerNote?: string | null
) {
  const row = await prisma.sigChangeRequest.findFirst({
    where: { id: requestId, documentId },
  });
  if (!row) throw new Error("Solicitud no encontrada");
  if (row.status !== "OPEN" && row.status !== "ACCEPTED") {
    throw new Error("La solicitud ya fue cerrada");
  }

  let status: SigChangeRequestStatus;
  if (action === "ACCEPT") status = "ACCEPTED";
  else if (action === "REJECT") status = "REJECTED";
  else status = "CANCELLED";

  if (action === "REJECT" && !reviewerNote?.trim()) {
    throw new Error("Indique el motivo del rechazo");
  }

  return prisma.sigChangeRequest.update({
    where: { id: requestId },
    data: {
      status,
      reviewerId,
      reviewerNote: reviewerNote?.trim().slice(0, 4000) ?? null,
      reviewedAt: new Date(),
    },
    include: changeRequestInclude,
  });
}
