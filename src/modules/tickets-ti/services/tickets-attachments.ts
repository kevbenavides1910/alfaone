import "server-only";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { prisma } from "@/modules/core/db/prisma";
import { ticketsTiUploadRoot } from "@/lib/storage/paths";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { writeTicketAudit } from "./ticket-audit";
import { writeTicketHistory } from "./ticket-history";
import { notifyTicketUsers } from "./ticket-notifications";
import { canViewTicket, canUploadTicketAttachment, canDownloadTicketAttachment } from "./ticket-access";
import { validateTicketAttachment } from "../validations/attachment.schema";
import { scanTicketAttachmentBeforeStore } from "./ticket-attachment-scan";
import type { TicketAttachmentContext } from "../config/tickets.config";

function ticketDir(ticketId: string) {
  return path.join(ticketsTiUploadRoot(), ticketId);
}

async function countExistingAttachments(ticketId: string, commentId?: string | null) {
  if (commentId) {
    return prisma.ticketAttachment.count({ where: { ticketId, commentId } });
  }
  return prisma.ticketAttachment.count({ where: { ticketId, commentId: null } });
}

export async function saveTicketAttachment(
  session: import("next-auth").Session | null,
  userId: string,
  ticketId: string,
  file: File,
  commentId?: string | null
) {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
  if (!ticket) throw new Error("Ticket no encontrado");
  if (!canUploadTicketAttachment(session, userId, ticket)) {
    throw new Error("Sin permiso para adjuntar archivos");
  }

  if (commentId) {
    const comment = await prisma.ticketComment.findFirst({
      where: { id: commentId, ticketId },
    });
    if (!comment) throw new Error("Comentario no encontrado");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const context: TicketAttachmentContext = commentId ? "comment" : "ticket";
  const [ticketCount, commentCount] = await Promise.all([
    countExistingAttachments(ticketId, null),
    commentId ? countExistingAttachments(ticketId, commentId) : Promise.resolve(0),
  ]);

  const validated = validateTicketAttachment({
    file,
    buffer: buf,
    context,
    existingTicketCount: ticketCount,
    existingCommentCount: commentCount,
  });
  if (!validated.ok) throw new Error(validated.error);

  const scan = await scanTicketAttachmentBeforeStore(buf, {
    fileName: validated.originalName,
    mimeType: validated.mimeType,
    extension: validated.extension,
  });
  if (!scan.clean) throw new Error(scan.reason);

  const storedName = `${Date.now()}_${validated.originalName}`;
  const hash = createHash("sha256").update(buf).digest("hex");

  await mkdir(ticketDir(ticketId), { recursive: true });
  const relPath = path.join(ticketId, storedName);
  await writeFile(path.join(ticketsTiUploadRoot(), relPath), buf);

  const attachment = await prisma.$transaction(async (tx) => {
    const row = await tx.ticketAttachment.create({
      data: {
        ticketId,
        commentId: commentId ?? null,
        uploadedById: userId,
        originalName: validated.originalName,
        storedName,
        mimeType: validated.mimeType,
        extension: validated.extension,
        fileSize: file.size,
        path: relPath,
        hash,
      },
    });
    await tx.ticket.update({ where: { id: ticketId }, data: { lastActivityAt: new Date() } });
    await writeTicketHistory(tx, {
      ticketId,
      changedById: userId,
      field: "attachment",
      newValue: validated.originalName,
    });
    await writeTicketAudit(tx, {
      ticketId,
      userId,
      action: "ticket.attachment",
      newValues: { fileName: validated.originalName, commentId: commentId ?? null },
    });
    await notifyTicketUsers(tx, {
      ticketId,
      userIds: [ticket.requesterId, ticket.assignedToId].filter(Boolean) as string[],
      title: "Archivo adjunto",
      message: validated.originalName,
      type: "ticket.attachment",
    });
    return row;
  });

  return {
    id: attachment.id,
    originalName: attachment.originalName,
    fileSize: attachment.fileSize,
    downloadUrl: `/api/tickets-ti/${ticketId}/attachments/${attachment.id}`,
  };
}

export async function readTicketAttachment(
  session: import("next-auth").Session | null,
  userId: string,
  ticketId: string,
  attachmentId: string
) {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
  if (!ticket) return null;

  if (!canDownloadTicketAttachment(session, userId, ticket)) return null;

  const att = await prisma.ticketAttachment.findFirst({
    where: { id: attachmentId, ticketId },
  });
  if (!att) return null;

  const abs = resolveUnderRoot(ticketsTiUploadRoot(), att.path);
  if (!abs) return null;
  const buffer = await readFile(abs);
  return { buffer, mimeType: att.mimeType, fileName: att.originalName };
}

export async function saveTicketAttachmentsBatch(
  session: import("next-auth").Session | null,
  userId: string,
  ticketId: string,
  files: File[],
  commentId?: string | null
) {
  const results = [];
  for (const file of files) {
    results.push(await saveTicketAttachment(session, userId, ticketId, file, commentId));
  }
  return results;
}
