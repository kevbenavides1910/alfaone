import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import {
  MAX_SIG_DOCUMENT_BYTES,
  SIG_DOCUMENTS_ROOT,
  storagePathForSigFile,
} from "./document-uploads";

const PDF_MIME = "application/pdf";

export async function listSigStandards() {
  const rows = await prisma.sigStandard.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    year: s.year,
    sortOrder: s.sortOrder,
    hasPdf: Boolean(s.pdfStoragePath),
    pdfFileName: s.pdfFileName,
    pdfUploadedAt: s.pdfUploadedAt?.toISOString() ?? null,
  }));
}

export async function getSigStandardPdf(standardId: string) {
  const row = await prisma.sigStandard.findUnique({
    where: { id: standardId },
    select: {
      id: true,
      code: true,
      name: true,
      pdfFileName: true,
      pdfMimeType: true,
      pdfStoragePath: true,
      pdfSizeBytes: true,
    },
  });
  if (!row?.pdfStoragePath || !row.pdfFileName) return null;

  const abs = resolveUnderRoot(SIG_DOCUMENTS_ROOT, row.pdfStoragePath);
  if (!abs) return null;
  const buffer = await readFile(abs).catch(() => null);
  if (!buffer) return null;

  return {
    buffer,
    fileName: row.pdfFileName,
    mimeType: row.pdfMimeType || PDF_MIME,
    code: row.code,
    name: row.name,
  };
}

export async function uploadSigStandardPdf(
  standardId: string,
  file: { buffer: Buffer; fileName: string; mimeType: string }
) {
  const standard = await prisma.sigStandard.findUnique({
    where: { id: standardId },
    select: { id: true, code: true, pdfStoragePath: true },
  });
  if (!standard) throw new Error("Norma no encontrada");

  if (file.mimeType !== PDF_MIME && !file.fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Solo se acepta PDF de la norma");
  }
  if (file.buffer.length > MAX_SIG_DOCUMENT_BYTES) {
    throw new Error("Archivo demasiado grande (máximo 50 MB)");
  }
  if (file.buffer.length < 5 || file.buffer.subarray(0, 4).toString("utf8") !== "%PDF") {
    throw new Error("El archivo no parece un PDF válido");
  }

  const folderKey = `standards/${standard.id}`;
  const safeName = `${Date.now()}_${file.fileName.replace(/[^\w.\-]+/g, "_")}`;
  const rel = storagePathForSigFile(folderKey, safeName);
  const absDir = path.join(SIG_DOCUMENTS_ROOT, folderKey);
  await mkdir(absDir, { recursive: true });
  const abs = path.join(SIG_DOCUMENTS_ROOT, rel);
  await writeFile(abs, file.buffer);

  if (standard.pdfStoragePath) {
    const oldAbs = resolveUnderRoot(SIG_DOCUMENTS_ROOT, standard.pdfStoragePath);
    if (oldAbs) await unlink(oldAbs).catch(() => null);
  }

  const updated = await prisma.sigStandard.update({
    where: { id: standardId },
    data: {
      pdfFileName: file.fileName.slice(0, 260),
      pdfMimeType: PDF_MIME,
      pdfStoragePath: rel,
      pdfSizeBytes: file.buffer.length,
      pdfUploadedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    code: updated.code,
    hasPdf: true,
    pdfFileName: updated.pdfFileName,
    pdfUploadedAt: updated.pdfUploadedAt?.toISOString() ?? null,
  };
}
