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

export type CreateSigDocumentInput = {
  code: string;
  title: string;
  documentTypeId: string;
  processId?: string | null;
  company?: string | null;
  revisionIntervalDays?: number | null;
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

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 80);
}

export async function createSigDocument(input: CreateSigDocumentInput, actorId: string) {
  const code = normalizeCode(input.code);
  if (!code) throw new Error("Código de documento requerido");

  const existing = await prisma.sigDocument.findUnique({ where: { code } });
  if (existing) throw new Error(`Ya existe un documento con código ${code}`);

  if (input.file.size > MAX_SIG_DOCUMENT_BYTES) {
    throw new Error("Archivo demasiado grande (máximo 50 MB)");
  }
  if (!ALLOWED_SIG_DOCUMENT_MIMES.has(input.file.mimeType)) {
    throw new Error("Tipo de archivo no permitido");
  }

  const checksum = createHash("sha256").update(input.file.buffer).digest("hex");
  const versionLabel = (input.versionLabel?.trim() || "1").slice(0, 40);
  const assignedApprover = await assertSigApproverUser(input.assignedApproverId);
  const storedName = `v1_${Date.now()}_${input.file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)}`;

  return prisma.$transaction(async (tx) => {
    const doc = await tx.sigDocument.create({
      data: {
        code,
        title: input.title.trim().slice(0, 500),
        documentTypeId: input.documentTypeId,
        processId: input.processId || null,
        company: input.company || null,
        status: "PENDING_APPROVAL",
        revisionIntervalDays: input.revisionIntervalDays ?? null,
        createdById: actorId,
      },
    });

    const dir = sigDocumentDir(doc.id);
    await mkdir(dir, { recursive: true });
    const rel = storagePathForSigFile(doc.id, storedName);
    await writeFile(path.join(dir, path.basename(storedName)), input.file.buffer);

    const version = await tx.sigDocumentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
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
      where: { id: doc.id },
      data: { currentVersionId: version.id },
    });

    await writeSigAuditLog(tx, {
      documentId: doc.id,
      versionId: version.id,
      action: "CREATED",
      actorId,
      notes: input.changeSummary ?? "Documento creado",
      metadata: { code, versionLabel },
    });

    await writeSigAuditLog(tx, {
      documentId: doc.id,
      versionId: version.id,
      action: "SUBMITTED_FOR_APPROVAL",
      actorId,
      metadata: {
        assignedApproverId: assignedApprover.id,
        assignedApproverName: assignedApprover.name,
      },
    });

    return tx.sigDocument.findUniqueOrThrow({
      where: { id: doc.id },
      include: {
        documentType: true,
        process: true,
        currentVersion: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  }).then((created) => {
    if (created.currentVersion?.id) {
      scheduleSigVersionTextIndex(created.currentVersion.id);
    }
    return created;
  });
}

/** Carga masiva: crea el documento ya aprobado, sin flujo de aprobación. */
export type CreateSigDocumentApprovedInput = Omit<CreateSigDocumentInput, "assignedApproverId">;

export async function createSigDocumentApproved(
  input: CreateSigDocumentApprovedInput,
  actorId: string,
) {
  const code = normalizeCode(input.code);
  if (!code) throw new Error("Código de documento requerido");

  const existing = await prisma.sigDocument.findUnique({ where: { code } });
  if (existing) throw new Error(`Ya existe un documento con código ${code}`);

  if (input.file.size > MAX_SIG_DOCUMENT_BYTES) {
    throw new Error("Archivo demasiado grande (máximo 50 MB)");
  }
  if (!ALLOWED_SIG_DOCUMENT_MIMES.has(input.file.mimeType)) {
    throw new Error("Tipo de archivo no permitido");
  }

  const checksum = createHash("sha256").update(input.file.buffer).digest("hex");
  const versionLabel = (input.versionLabel?.trim() || "1").slice(0, 40);
  const storedName = `v1_${Date.now()}_${input.file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)}`;
  const approvedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const doc = await tx.sigDocument.create({
      data: {
        code,
        title: input.title.trim().slice(0, 500),
        documentTypeId: input.documentTypeId,
        processId: input.processId || null,
        company: input.company || null,
        status: "APPROVED",
        revisionIntervalDays: input.revisionIntervalDays ?? null,
        createdById: actorId,
      },
    });

    const dir = sigDocumentDir(doc.id);
    await mkdir(dir, { recursive: true });
    const rel = storagePathForSigFile(doc.id, storedName);
    await writeFile(path.join(dir, path.basename(storedName)), input.file.buffer);

    const version = await tx.sigDocumentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
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
        status: "APPROVED",
        uploadedById: actorId,
        assignedApproverId: null,
        approvedById: actorId,
        approvedAt,
      },
    });

    await tx.sigDocument.update({
      where: { id: doc.id },
      data: { currentVersionId: version.id },
    });

    await writeSigAuditLog(tx, {
      documentId: doc.id,
      versionId: version.id,
      action: "CREATED",
      actorId,
      notes: input.changeSummary ?? "Documento creado (carga masiva)",
      metadata: { code, versionLabel, bulkImport: true },
    });

    await writeSigAuditLog(tx, {
      documentId: doc.id,
      versionId: version.id,
      action: "APPROVED",
      actorId,
      notes: "Publicado directamente en carga masiva",
      metadata: { versionNumber: version.versionNumber, versionLabel },
    });

    return tx.sigDocument.findUniqueOrThrow({
      where: { id: doc.id },
      include: {
        documentType: true,
        process: true,
        currentVersion: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  }).then((created) => {
    if (created.currentVersion?.id) {
      scheduleSigVersionTextIndex(created.currentVersion.id);
    }
    return created;
  });
}

export async function getSigDocumentDetail(documentId: string) {
  return prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: {
      documentType: true,
      process: true,
      companyEntity: { select: { code: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      currentVersion: {
        include: {
          uploadedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          assignedApprover: { select: { id: true, name: true, email: true } },
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          uploadedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          assignedApprover: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export async function updateSigDocumentMetadata(
  documentId: string,
  actorId: string,
  data: {
    title?: string;
    processId?: string | null;
    company?: string | null;
    revisionIntervalDays?: number | null;
  }
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.sigDocument.update({
      where: { id: documentId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim().slice(0, 500) } : {}),
        ...(data.processId !== undefined ? { processId: data.processId || null } : {}),
        ...(data.company !== undefined ? { company: data.company || null } : {}),
        ...(data.revisionIntervalDays !== undefined
          ? { revisionIntervalDays: data.revisionIntervalDays }
          : {}),
      },
    });

    await writeSigAuditLog(tx, {
      documentId,
      action: "UPDATED",
      actorId,
      notes: "Metadatos actualizados",
      metadata: data as Record<string, unknown>,
    });

    return updated;
  });
}
