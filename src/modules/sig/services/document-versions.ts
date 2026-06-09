import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { writeSigAuditLog } from "./audit-log";
import { assertSigApproverUser } from "./approvers";
import { scheduleSigVersionTextIndex } from "./text-extraction";
import {
  ALLOWED_SIG_DOCUMENT_MIMES,
  MAX_SIG_DOCUMENT_BYTES,
  sigDocumentDir,
  storagePathForSigFile,
} from "./document-uploads";

export type NewVersionInput = {
  versionLabel?: string;
  revisionDate: Date;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
  changeSummary?: string | null;
  assignedApproverId: string;
  file: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    size: number;
  };
};

export type SameVersionUpdateInput = {
  revisionDate?: Date;
  effectiveFrom?: Date;
  effectiveUntil?: Date | null;
  changeSummary?: string | null;
};

/** Sube una nueva versión del documento (archivo nuevo, número incrementado). */
export async function uploadSigNewVersion(
  documentId: string,
  actorId: string,
  input: NewVersionInput
) {
  if (input.file.size > MAX_SIG_DOCUMENT_BYTES) {
    throw new Error("Archivo demasiado grande (máximo 50 MB)");
  }
  if (!ALLOWED_SIG_DOCUMENT_MIMES.has(input.file.mimeType)) {
    throw new Error("Tipo de archivo no permitido");
  }

  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!doc) throw new Error("Documento no encontrado");
  if (doc.status === "OBSOLETE") throw new Error("El documento está obsoleto");

  const lastNumber = doc.versions[0]?.versionNumber ?? 0;
  const nextNumber = lastNumber + 1;
  const versionLabel = (input.versionLabel?.trim() || String(nextNumber)).slice(0, 40);
  const assignedApprover = await assertSigApproverUser(input.assignedApproverId);
  const checksum = createHash("sha256").update(input.file.buffer).digest("hex");
  const storedName = `v${nextNumber}_${Date.now()}_${input.file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)}`;

  return prisma.$transaction(async (tx) => {
    const dir = sigDocumentDir(documentId);
    await mkdir(dir, { recursive: true });
    const rel = storagePathForSigFile(documentId, storedName);
    await writeFile(path.join(dir, path.basename(storedName)), input.file.buffer);

    const version = await tx.sigDocumentVersion.create({
      data: {
        documentId,
        versionNumber: nextNumber,
        versionLabel,
        fileName: input.file.fileName.slice(0, 255),
        mimeType: input.file.mimeType,
        storagePath: rel,
        fileSizeBytes: input.file.size,
        checksum,
        revisionDate: input.revisionDate,
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil ?? null,
        changeSummary: input.changeSummary?.trim().slice(0, 4000) ?? null,
        status: "PENDING_APPROVAL",
        uploadedById: actorId,
        assignedApproverId: assignedApprover.id,
      },
    });

    await tx.sigDocument.update({
      where: { id: documentId },
      data: { status: "PENDING_APPROVAL", currentVersionId: version.id },
    });

    await writeSigAuditLog(tx, {
      documentId,
      versionId: version.id,
      action: "NEW_VERSION",
      actorId,
      notes: input.changeSummary ?? `Nueva versión ${versionLabel}`,
      metadata: { versionNumber: nextNumber, versionLabel },
    });

    await writeSigAuditLog(tx, {
      documentId,
      versionId: version.id,
      action: "SUBMITTED_FOR_APPROVAL",
      actorId,
      metadata: {
        assignedApproverId: assignedApprover.id,
        assignedApproverName: assignedApprover.name,
      },
    });

    return version;
  }).then((version) => {
    scheduleSigVersionTextIndex(version.id);
    return version;
  });
}

/** Actualiza fechas de revisión/vigencia sin cambiar número de versión ni archivo. */
export async function updateSigSameVersion(
  documentId: string,
  actorId: string,
  input: SameVersionUpdateInput
) {
  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: { currentVersion: true },
  });
  if (!doc?.currentVersion) throw new Error("Documento sin versión actual");
  if (doc.currentVersion.status !== "APPROVED") {
    throw new Error("Solo se puede actualizar vigencia en la versión aprobada vigente");
  }

  const versionId = doc.currentVersion.id;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.sigDocumentVersion.update({
      where: { id: versionId },
      data: {
        ...(input.revisionDate !== undefined ? { revisionDate: input.revisionDate } : {}),
        ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
        ...(input.effectiveUntil !== undefined ? { effectiveUntil: input.effectiveUntil } : {}),
        ...(input.changeSummary !== undefined
          ? { changeSummary: input.changeSummary?.trim().slice(0, 4000) ?? null }
          : {}),
      },
    });

    const action = input.revisionDate !== undefined ? "REVISION_DATE_UPDATED" : "SAME_VERSION_UPDATED";

    await writeSigAuditLog(tx, {
      documentId,
      versionId,
      action,
      actorId,
      notes: input.changeSummary ?? "Actualización de vigencia sin cambio de versión",
      metadata: {
        revisionDate: updated.revisionDate.toISOString(),
        effectiveFrom: updated.effectiveFrom.toISOString(),
        effectiveUntil: updated.effectiveUntil?.toISOString() ?? null,
      },
    });

    return updated;
  });
}
