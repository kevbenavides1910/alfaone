import "server-only";
import { mkdir, readFile, rm, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/modules/core/db/prisma";
import { calendarioOperativoUploadRoot } from "@/lib/storage/paths";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import {
  CALENDARIO_EVIDENCE_EXTENSIONS,
  CALENDARIO_EVIDENCE_MAX_BYTES,
  CALENDARIO_EVIDENCE_MAX_FILES,
} from "@/modules/naf-operaciones/business/calendario-types";
import { CalendarioError, type CalendarioActor } from "@/modules/naf-operaciones/services/calendario-eventos";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

function sanitizeName(name: string): string {
  const base = path.basename(name).normalize("NFC");
  const clean = base.replace(/[^\p{L}\p{N}._ -]+/gu, "_").replace(/\s+/g, " ").trim();
  return (clean || "archivo").slice(0, 150);
}

export async function saveCalendarioEvidence(
  eventId: string,
  files: File[],
  contractId: string | null,
  actor: CalendarioActor,
): Promise<number> {
  if (files.length === 0) throw new CalendarioError("Adjunte al menos un archivo");
  if (files.length > CALENDARIO_EVIDENCE_MAX_FILES) {
    throw new CalendarioError(`Máximo ${CALENDARIO_EVIDENCE_MAX_FILES} archivos por carga`);
  }
  if (contractId) {
    const link = await prisma.operationalCalendarEventContract.findUnique({
      where: { eventId_contractId: { eventId, contractId } },
      select: { id: true },
    });
    if (!link) throw new CalendarioError("El contrato no pertenece a este evento");
  }

  const prepared = await Promise.all(
    files.map(async (file) => {
      const originalName = sanitizeName(file.name);
      const ext = path.extname(originalName).slice(1).toLowerCase();
      if (!(CALENDARIO_EVIDENCE_EXTENSIONS as readonly string[]).includes(ext)) {
        throw new CalendarioError(`Tipo de archivo no permitido: ${originalName}`);
      }
      if (file.size === 0) throw new CalendarioError(`Archivo vacío: ${originalName}`);
      if (file.size > CALENDARIO_EVIDENCE_MAX_BYTES) {
        throw new CalendarioError(`«${originalName}» supera ${CALENDARIO_EVIDENCE_MAX_BYTES / 1024 / 1024} MB`);
      }
      return { file, originalName, ext, buffer: Buffer.from(await file.arrayBuffer()) };
    }),
  );

  const root = calendarioOperativoUploadRoot();
  await mkdir(path.join(root, eventId), { recursive: true });

  const rows = [];
  for (const p of prepared) {
    const storedName = `${randomUUID()}.${p.ext}`;
    const relPath = path.join(eventId, storedName);
    await writeFile(path.join(root, relPath), p.buffer);
    rows.push({
      eventId,
      contractId,
      uploadedById: actor.id,
      uploadedByName: actor.name ?? null,
      originalName: p.originalName,
      storedName,
      mimeType: MIME_BY_EXT[p.ext] ?? "application/octet-stream",
      fileSize: p.file.size,
      path: relPath,
    });
  }
  await prisma.operationalCalendarEventAttachment.createMany({ data: rows });
  return rows.length;
}

export async function readCalendarioEvidence(eventId: string, attachmentId: string) {
  const att = await prisma.operationalCalendarEventAttachment.findFirst({
    where: { id: attachmentId, eventId },
  });
  if (!att) return null;
  const abs = resolveUnderRoot(calendarioOperativoUploadRoot(), att.path);
  if (!abs) return null;
  const buffer = await readFile(abs).catch(() => null);
  if (!buffer) return null;
  return { buffer, mimeType: att.mimeType, fileName: att.originalName };
}

export async function deleteCalendarioEvidence(eventId: string, attachmentId: string): Promise<void> {
  const att = await prisma.operationalCalendarEventAttachment.findFirst({
    where: { id: attachmentId, eventId },
    select: { id: true, path: true },
  });
  if (!att) throw new CalendarioError("Evidencia no encontrada", 404);
  await prisma.operationalCalendarEventAttachment.delete({ where: { id: att.id } });
  const abs = resolveUnderRoot(calendarioOperativoUploadRoot(), att.path);
  if (abs) await unlink(abs).catch(() => undefined);
}

/** Borra la carpeta de evidencias del evento (las filas caen en cascada con el evento). */
export async function removeCalendarioEvidenceDir(eventId: string): Promise<void> {
  const abs = resolveUnderRoot(calendarioOperativoUploadRoot(), eventId);
  if (abs) await rm(abs, { recursive: true, force: true }).catch(() => undefined);
}
