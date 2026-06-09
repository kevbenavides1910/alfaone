import { createSigDocumentApproved } from "./documents";
import { normalizeSigDocumentCode } from "./parse-filename";

export type BulkSigDocumentItem = {
  code: string;
  title: string;
  versionLabel: string;
  file: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    size: number;
  };
};

export type BulkSigDocumentShared = {
  documentTypeId: string;
  processId?: string | null;
  company?: string | null;
  revisionIntervalDays?: number | null;
  changeSummary?: string | null;
};

export type BulkSigImportResultRow = {
  index: number;
  fileName: string;
  code: string;
  success: boolean;
  documentId?: string;
  error?: string;
};

export type BulkSigImportResult = {
  total: number;
  created: number;
  failed: number;
  results: BulkSigImportResultRow[];
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function bulkCreateSigDocuments(
  shared: BulkSigDocumentShared,
  items: BulkSigDocumentItem[],
  actorId: string,
): Promise<BulkSigImportResult> {
  if (items.length === 0) {
    throw new Error("Debe incluir al menos un archivo");
  }

  const seenCodes = new Set<string>();
  const results: BulkSigImportResultRow[] = [];
  const uploadDate = startOfToday();

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const code = normalizeSigDocumentCode(item.code);
    const fileName = item.file.fileName;

    if (!code) {
      results.push({
        index,
        fileName,
        code: item.code,
        success: false,
        error: "Código requerido",
      });
      continue;
    }

    if (!item.title.trim()) {
      results.push({
        index,
        fileName,
        code,
        success: false,
        error: "Título requerido",
      });
      continue;
    }

    if (seenCodes.has(code)) {
      results.push({
        index,
        fileName,
        code,
        success: false,
        error: `Código duplicado en esta carga: ${code}`,
      });
      continue;
    }
    seenCodes.add(code);

    try {
      const doc = await createSigDocumentApproved(
        {
          code,
          title: item.title.trim(),
          documentTypeId: shared.documentTypeId,
          processId: shared.processId ?? null,
          company: shared.company ?? null,
          revisionIntervalDays: shared.revisionIntervalDays ?? null,
          versionLabel: item.versionLabel.trim() || "1",
          revisionDate: uploadDate,
          effectiveFrom: uploadDate,
          effectiveUntil: null,
          changeSummary: shared.changeSummary ?? "Carga masiva SIG",
          file: item.file,
        },
        actorId,
      );

      results.push({
        index,
        fileName,
        code: doc.code,
        success: true,
        documentId: doc.id,
      });
    } catch (e) {
      results.push({
        index,
        fileName,
        code,
        success: false,
        error: e instanceof Error ? e.message : "Error al crear documento",
      });
    }
  }

  const created = results.filter((r) => r.success).length;

  return {
    total: items.length,
    created,
    failed: items.length - created,
    results,
  };
}
