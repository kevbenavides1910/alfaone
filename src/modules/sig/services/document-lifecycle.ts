import { prisma } from "@/modules/core/db/prisma";
import { writeSigAuditLog } from "./audit-log";

export type SupersedeDocumentInput = {
  supersededById: string;
  reason?: string | null;
  /** Usuarios que deben acusar lectura del documento sustituto. */
  assigneeUserIds?: string[];
  readDueDate?: Date | string | null;
  createReadCampaign?: boolean;
};

/** Marca A obsoleto y lo enlaza al documento B que lo sustituye. */
export async function supersedeSigDocument(
  documentId: string,
  actorId: string,
  input: SupersedeDocumentInput
) {
  if (input.supersededById === documentId) {
    throw new Error("Un documento no puede sustituirse a sí mismo");
  }

  const [docA, docB] = await Promise.all([
    prisma.sigDocument.findUnique({
      where: { id: documentId },
      select: { id: true, code: true, title: true, status: true },
    }),
    prisma.sigDocument.findUnique({
      where: { id: input.supersededById },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        currentVersionId: true,
      },
    }),
  ]);
  if (!docA) throw new Error("Documento a obsoleter no encontrado");
  if (!docB) throw new Error("Documento sustituto no encontrado");
  if (docB.status === "OBSOLETE") {
    throw new Error("El documento sustituto no puede estar obsoleto");
  }

  const now = new Date();
  const reason =
    input.reason?.trim().slice(0, 4000) ||
    `Sustituido por ${docB.code} — ${docB.title}`;

  return prisma.$transaction(async (tx) => {
    await tx.sigDocument.update({
      where: { id: documentId },
      data: {
        status: "OBSOLETE",
        supersededById: docB.id,
        obsoleteAt: now,
        obsoleteReason: reason,
      },
    });

    await writeSigAuditLog(tx, {
      documentId,
      action: "OBSOLETED",
      actorId,
      notes: reason,
      metadata: { supersededById: docB.id, supersededByCode: docB.code },
    });

    await writeSigAuditLog(tx, {
      documentId: docB.id,
      versionId: docB.currentVersionId,
      action: "UPDATED",
      actorId,
      notes: `Sustituye a ${docA.code}`,
      metadata: { supersedesDocumentId: docA.id },
    });

    let campaignId: string | null = null;
    const assignees = [...new Set((input.assigneeUserIds ?? []).filter(Boolean))];
    if (input.createReadCampaign !== false && assignees.length > 0) {
      const due =
        input.readDueDate == null || input.readDueDate === ""
          ? new Date(now.getTime() + 14 * 86_400_000)
          : input.readDueDate instanceof Date
            ? input.readDueDate
            : new Date(input.readDueDate);

      const campaign = await tx.sigDocumentReadCampaign.create({
        data: {
          documentId: docB.id,
          versionId: docB.currentVersionId,
          supersedesDocumentId: docA.id,
          title: `Leer ${docB.code} (sustituye ${docA.code})`,
          dueDate: Number.isNaN(due.getTime()) ? null : due,
          createdById: actorId,
          assignees: {
            create: assignees.map((userId) => ({ userId })),
          },
        },
      });
      campaignId = campaign.id;
    }

    return { documentId, supersededById: docB.id, campaignId };
  });
}

export async function markSigDocumentObsolete(
  documentId: string,
  actorId: string,
  notes?: string,
  opts?: { supersededById?: string | null; assigneeUserIds?: string[] }
) {
  if (opts?.supersededById) {
    return supersedeSigDocument(documentId, actorId, {
      supersededById: opts.supersededById,
      reason: notes,
      assigneeUserIds: opts.assigneeUserIds,
      createReadCampaign: true,
    });
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.sigDocument.update({
      where: { id: documentId },
      data: {
        status: "OBSOLETE",
        obsoleteAt: now,
        obsoleteReason: notes?.trim().slice(0, 4000) || "Documento marcado como obsoleto",
      },
    });

    await writeSigAuditLog(tx, {
      documentId,
      action: "OBSOLETED",
      actorId,
      notes: notes?.trim().slice(0, 4000) ?? "Documento marcado como obsoleto",
    });
  });
}

export async function createSigReadCampaign(input: {
  documentId: string;
  actorId: string;
  title?: string;
  versionId?: string | null;
  supersedesDocumentId?: string | null;
  dueDate?: Date | string | null;
  assigneeUserIds: string[];
}) {
  const doc = await prisma.sigDocument.findUnique({
    where: { id: input.documentId },
    select: { id: true, code: true, title: true, currentVersionId: true },
  });
  if (!doc) throw new Error("Documento no encontrado");
  const assignees = [...new Set(input.assigneeUserIds.filter(Boolean))];
  if (!assignees.length) throw new Error("Indique al menos un destinatario");

  const due =
    input.dueDate == null || input.dueDate === ""
      ? new Date(Date.now() + 14 * 86_400_000)
      : input.dueDate instanceof Date
        ? input.dueDate
        : new Date(input.dueDate);

  return prisma.sigDocumentReadCampaign.create({
    data: {
      documentId: doc.id,
      versionId: input.versionId || doc.currentVersionId,
      supersedesDocumentId: input.supersedesDocumentId || null,
      title: (input.title?.trim() || `Lectura obligatoria: ${doc.code}`).slice(0, 300),
      dueDate: Number.isNaN(due.getTime()) ? null : due,
      createdById: input.actorId,
      assignees: { create: assignees.map((userId) => ({ userId })) },
    },
    include: {
      document: { select: { id: true, code: true, title: true } },
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
}

export async function listPendingSigReadAcks(userId: string) {
  const rows = await prisma.sigDocumentReadAssignee.findMany({
    where: {
      userId,
      campaign: {
        acknowledgments: { none: { userId } },
      },
    },
    include: {
      campaign: {
        include: {
          document: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              currentVersion: { select: { id: true, versionLabel: true } },
            },
          },
          supersedesDocument: { select: { id: true, code: true, title: true } },
          version: { select: { id: true, versionLabel: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return rows.map((r) => ({
    campaignId: r.campaignId,
    title: r.campaign.title,
    dueDate: r.campaign.dueDate,
    document: r.campaign.document,
    version: r.campaign.version,
    supersedesDocument: r.campaign.supersedesDocument,
  }));
}

export async function acknowledgeSigDocumentRead(input: {
  campaignId: string;
  userId: string;
  note?: string | null;
}) {
  const campaign = await prisma.sigDocumentReadCampaign.findUnique({
    where: { id: input.campaignId },
    include: {
      assignees: { where: { userId: input.userId }, take: 1 },
    },
  });
  if (!campaign) throw new Error("Campaña no encontrada");
  if (!campaign.assignees.length) {
    throw new Error("No está asignado a esta lectura");
  }

  return prisma.sigDocumentAcknowledgment.upsert({
    where: {
      campaignId_userId: { campaignId: input.campaignId, userId: input.userId },
    },
    create: {
      campaignId: input.campaignId,
      userId: input.userId,
      versionId: campaign.versionId,
      documentId: campaign.documentId,
      note: input.note?.trim().slice(0, 2000) || null,
    },
    update: {
      acknowledgedAt: new Date(),
      note: input.note?.trim().slice(0, 2000) || null,
      versionId: campaign.versionId,
    },
  });
}

export async function listCampaignAcks(campaignId: string) {
  return prisma.sigDocumentReadCampaign.findUnique({
    where: { id: campaignId },
    include: {
      document: { select: { id: true, code: true, title: true } },
      assignees: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      acknowledgments: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { acknowledgedAt: "desc" },
      },
    },
  });
}
