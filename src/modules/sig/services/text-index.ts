import { readFile } from "fs/promises";
import { prisma } from "@/modules/core/db/prisma";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { SIG_DOCUMENTS_ROOT } from "./document-uploads";
import { extractDocumentText } from "./text-extraction";

/** Lee el archivo en disco, extrae texto (OCR si aplica) y lo guarda en la versión. */
export async function indexSigDocumentVersionText(versionId: string) {
  const version = await prisma.sigDocumentVersion.findUnique({
    where: { id: versionId },
    select: { id: true, storagePath: true, mimeType: true, fileName: true },
  });
  if (!version) return;

  const abs = resolveUnderRoot(SIG_DOCUMENTS_ROOT, version.storagePath);
  if (!abs) {
    await prisma.sigDocumentVersion.update({
      where: { id: versionId },
      data: { textIndexStatus: "FAILED", textIndexedAt: new Date() },
    });
    return;
  }

  try {
    const buffer = await readFile(abs);
    const text = await extractDocumentText(buffer, version.mimeType, version.fileName);

    await prisma.sigDocumentVersion.update({
      where: { id: versionId },
      data: {
        extractedText: text || null,
        textIndexStatus: text ? "DONE" : "SKIPPED",
        textIndexedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[SIG] Falló indexación de texto:", versionId, err);
    await prisma.sigDocumentVersion.update({
      where: { id: versionId },
      data: { textIndexStatus: "FAILED", textIndexedAt: new Date() },
    });
  }
}
