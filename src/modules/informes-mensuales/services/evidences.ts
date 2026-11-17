import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { monthlyReportsUploadRoot } from "@/lib/storage/paths";
import { detectMimeFromBuffer } from "@/lib/security/file-validation";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { MonthlyReportError } from "./reports";

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;

const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

export const ALLOWED_EVIDENCE_EXTENSIONS = new Set(Object.keys(EXTENSION_MIME));

export type MonthlyIncidentEvidenceDto = {
  id: string;
  incidentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
  downloadUrl: string;
};

function toDto(row: {
  id: string;
  incidentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: Date;
}): MonthlyIncidentEvidenceDto {
  return {
    id: row.id,
    incidentId: row.incidentId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedById: row.uploadedById,
    uploadedByName: row.uploadedByName,
    createdAt: row.createdAt.toISOString(),
    downloadUrl: `/api/informes-mensuales/incidencias/${row.incidentId}/evidencias/${row.id}`,
  };
}

async function assertIncidentExists(incidentId: string) {
  const incident = await prisma.monthlyIncident.findUnique({
    where: { id: incidentId },
    select: { id: true },
  });
  if (!incident) throw new MonthlyReportError("Incidencia no encontrada", "NOT_FOUND");
}

export async function listIncidentEvidences(
  incidentId: string,
): Promise<MonthlyIncidentEvidenceDto[]> {
  await assertIncidentExists(incidentId);
  const rows = await prisma.monthlyIncidentEvidence.findMany({
    where: { incidentId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

export async function saveIncidentEvidence(input: {
  incidentId: string;
  userId: string;
  userName: string;
  fileName: string;
  buffer: Buffer;
}): Promise<MonthlyIncidentEvidenceDto> {
  await assertIncidentExists(input.incidentId);

  if (input.buffer.length === 0) throw new MonthlyReportError("El archivo está vacío");
  if (input.buffer.length > MAX_EVIDENCE_BYTES) {
    throw new MonthlyReportError("Archivo demasiado grande (máximo 25 MB)");
  }

  const extension = path.extname(input.fileName).toLowerCase();
  const expectedMime = EXTENSION_MIME[extension];
  if (!expectedMime) {
    throw new MonthlyReportError(
      "Formato no permitido (PDF, Word, Excel, PowerPoint, imágenes, CSV o TXT)",
    );
  }

  const detected = detectMimeFromBuffer(input.buffer);
  if (detected !== "application/octet-stream" && detected !== expectedMime) {
    throw new MonthlyReportError("El contenido del archivo no coincide con su extensión");
  }

  const dir = path.join(monthlyReportsUploadRoot(), "incidencias", input.incidentId);
  await mkdir(dir, { recursive: true });

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "evidencia";
  const storedName = `${Date.now()}_${safeName}`;
  await writeFile(path.join(dir, storedName), input.buffer);

  const row = await prisma.monthlyIncidentEvidence.create({
    data: {
      incidentId: input.incidentId,
      fileName: input.fileName.slice(0, 255),
      mimeType: expectedMime,
      storagePath: path.posix.join("incidencias", input.incidentId, storedName),
      sizeBytes: input.buffer.length,
      uploadedById: input.userId,
      uploadedByName: input.userName,
    },
  });

  return toDto(row);
}

export async function getIncidentEvidenceFile(incidentId: string, evidenceId: string) {
  const row = await prisma.monthlyIncidentEvidence.findFirst({
    where: { id: evidenceId, incidentId },
  });
  if (!row) throw new MonthlyReportError("Evidencia no encontrada", "NOT_FOUND");

  const absolutePath = resolveUnderRoot(monthlyReportsUploadRoot(), row.storagePath);
  if (!absolutePath) throw new MonthlyReportError("Evidencia no encontrada", "NOT_FOUND");

  return { row, absolutePath };
}

export async function deleteIncidentEvidence(incidentId: string, evidenceId: string): Promise<void> {
  const { row, absolutePath } = await getIncidentEvidenceFile(incidentId, evidenceId);
  await prisma.monthlyIncidentEvidence.delete({ where: { id: row.id } });
  await unlink(absolutePath).catch(() => undefined);
}
