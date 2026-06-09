import { prisma } from "@/modules/core/db/prisma";
import { writeSigAuditLog } from "./audit-log";

export async function approveSigDocument(
  documentId: string,
  versionId: string,
  actorId: string,
  notes?: string | null
) {
  return prisma.$transaction(async (tx) => {
    const doc = await tx.sigDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: { where: { status: "APPROVED" }, select: { id: true } },
      },
    });
    if (!doc) throw new Error("Documento no encontrado");

    const version = await tx.sigDocumentVersion.findFirst({
      where: { id: versionId, documentId, status: "PENDING_APPROVAL" },
    });
    if (!version) throw new Error("Versión pendiente no encontrada");
    if (!version.assignedApproverId) {
      throw new Error("Esta versión no tiene aprobador asignado");
    }
    if (version.assignedApproverId !== actorId) {
      throw new Error("Solo el aprobador asignado puede aprobar este documento");
    }

    const now = new Date();

    await tx.sigDocumentVersion.update({
      where: { id: versionId },
      data: {
        status: "APPROVED",
        approvedById: actorId,
        approvedAt: now,
        rejectionNote: null,
      },
    });

    if (doc.versions.length > 0) {
      await tx.sigDocumentVersion.updateMany({
        where: {
          documentId,
          id: { in: doc.versions.map((v) => v.id) },
          status: "APPROVED",
        },
        data: { status: "SUPERSEDED" },
      });
    }

    await tx.sigDocument.update({
      where: { id: documentId },
      data: {
        status: "APPROVED",
        currentVersionId: versionId,
      },
    });

    await writeSigAuditLog(tx, {
      documentId,
      versionId,
      action: "APPROVED",
      actorId,
      notes: notes?.trim().slice(0, 4000) ?? null,
      metadata: { versionNumber: version.versionNumber, versionLabel: version.versionLabel },
    });

    return tx.sigDocument.findUniqueOrThrow({
      where: { id: documentId },
      include: {
        currentVersion: {
          include: { approvedBy: { select: { id: true, name: true } } },
        },
      },
    });
  });
}

export async function rejectSigDocument(
  documentId: string,
  versionId: string,
  actorId: string,
  rejectionNote: string
) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.sigDocumentVersion.findFirst({
      where: { id: versionId, documentId, status: "PENDING_APPROVAL" },
    });
    if (!version) throw new Error("Versión pendiente no encontrada");
    if (!version.assignedApproverId) {
      throw new Error("Esta versión no tiene aprobador asignado");
    }
    if (version.assignedApproverId !== actorId) {
      throw new Error("Solo el aprobador asignado puede rechazar este documento");
    }

    await tx.sigDocumentVersion.update({
      where: { id: versionId },
      data: {
        status: "REJECTED",
        rejectionNote: rejectionNote.trim().slice(0, 4000),
      },
    });

    const lastApproved = await tx.sigDocumentVersion.findFirst({
      where: { documentId, status: "APPROVED" },
      orderBy: { versionNumber: "desc" },
    });

    await tx.sigDocument.update({
      where: { id: documentId },
      data: {
        status: lastApproved ? "APPROVED" : "REJECTED",
        currentVersionId: lastApproved?.id ?? null,
      },
    });

    await writeSigAuditLog(tx, {
      documentId,
      versionId,
      action: "REJECTED",
      actorId,
      notes: rejectionNote.trim().slice(0, 4000),
    });

    return { rejectedVersionId: versionId, restoredVersionId: lastApproved?.id ?? null };
  });
}

export async function markSigDocumentObsolete(documentId: string, actorId: string, notes?: string) {
  return prisma.$transaction(async (tx) => {
    await tx.sigDocument.update({
      where: { id: documentId },
      data: { status: "OBSOLETE" },
    });

    await writeSigAuditLog(tx, {
      documentId,
      action: "OBSOLETED",
      actorId,
      notes: notes?.trim().slice(0, 4000) ?? "Documento marcado como obsoleto",
    });
  });
}
