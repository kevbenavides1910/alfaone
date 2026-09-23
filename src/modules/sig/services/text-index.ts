import { readFile } from "fs/promises";
import { prisma } from "@/modules/core/db/prisma";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { SIG_DOCUMENTS_ROOT } from "./document-uploads";
import { extractDocumentText } from "./text-extraction";

export type IndexSigVersionOpts = {
  /** Regenera prosa Alfa aunque ya hubiera snapshot (p. ej. archivo nuevo). */
  replaceProcedure?: boolean;
  /** Si OCR falla/vacío, copia estructura de esta versión. */
  fallbackFromVersionId?: string | null;
};

export type IndexSigVersionResult = {
  textIndexStatus: "DONE" | "FAILED" | "SKIPPED";
  bootstrapped: boolean;
  copiedFromPrevious: boolean;
  activitiesCount: number;
  hasExtractedText: boolean;
};

/** Lee el archivo en disco, extrae texto (OCR si aplica) y lo guarda en la versión. */
export async function indexSigDocumentVersionText(
  versionId: string,
  opts?: IndexSigVersionOpts
): Promise<IndexSigVersionResult> {
  const empty: IndexSigVersionResult = {
    textIndexStatus: "FAILED",
    bootstrapped: false,
    copiedFromPrevious: false,
    activitiesCount: 0,
    hasExtractedText: false,
  };

  const version = await prisma.sigDocumentVersion.findUnique({
    where: { id: versionId },
    select: { id: true, storagePath: true, mimeType: true, fileName: true },
  });
  if (!version) return empty;

  const abs = resolveUnderRoot(SIG_DOCUMENTS_ROOT, version.storagePath);
  if (!abs) {
    await prisma.sigDocumentVersion.update({
      where: { id: versionId },
      data: { textIndexStatus: "FAILED", textIndexedAt: new Date() },
    });
    const copied = await maybeCopyFallback(versionId, opts);
    return { ...empty, textIndexStatus: "FAILED", copiedFromPrevious: copied };
  }

  try {
    const buffer = await readFile(abs);
    const text = await extractDocumentText(buffer, version.mimeType, version.fileName);
    const textIndexStatus = text ? ("DONE" as const) : ("SKIPPED" as const);

    await prisma.sigDocumentVersion.update({
      where: { id: versionId },
      data: {
        extractedText: text || null,
        textIndexStatus,
        textIndexedAt: new Date(),
      },
    });

    let bootstrapped = false;
    let copiedFromPrevious = false;

    if (text?.trim()) {
      const { tryAutoBootstrapProcedureVersion } = await import("./procedure-content");
      bootstrapped = await tryAutoBootstrapProcedureVersion(versionId, {
        replaceExisting: opts?.replaceProcedure === true,
      });
      if (bootstrapped) {
        console.info("[SIG] Conversión Alfa automática:", versionId);
      }
    }

    if (!bootstrapped) {
      copiedFromPrevious = await maybeCopyFallback(versionId, opts);
    }

    const activitiesCount = await prisma.sigProcedureActivity.count({
      where: { versionId },
    });

    return {
      textIndexStatus,
      bootstrapped,
      copiedFromPrevious,
      activitiesCount,
      hasExtractedText: Boolean(text?.trim()),
    };
  } catch (err) {
    console.error("[SIG] Falló indexación de texto:", versionId, err);
    await prisma.sigDocumentVersion.update({
      where: { id: versionId },
      data: { textIndexStatus: "FAILED", textIndexedAt: new Date() },
    });
    const copied = await maybeCopyFallback(versionId, opts);
    return { ...empty, textIndexStatus: "FAILED", copiedFromPrevious: copied };
  }
}

async function maybeCopyFallback(
  versionId: string,
  opts?: IndexSigVersionOpts
): Promise<boolean> {
  try {
    const { copyProcedureSnapshotToVersion, ensureProcedureSnapshotFromPrevious } =
      await import("./procedure-content");
    if (opts?.fallbackFromVersionId) {
      return copyProcedureSnapshotToVersion(opts.fallbackFromVersionId, versionId);
    }
    return ensureProcedureSnapshotFromPrevious(versionId);
  } catch (err) {
    console.error("[SIG] Error copiando snapshot de versión previa:", versionId, err);
    return false;
  }
}
