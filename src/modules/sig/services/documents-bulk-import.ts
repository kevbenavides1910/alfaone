import { prisma } from "@/modules/core/db/prisma";
import { createSigDocumentApproved } from "./documents";
import { normalizeSigDocumentCode } from "./parse-filename";
import { isProcedureLikeType } from "./procedure-content";
import { indexSigDocumentVersionText } from "./text-index";

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

export type BulkConversionStatus =
  | "OK"
  | "PENDING"
  | "INDEX_FAILED"
  | "INDEX_SKIPPED"
  | "NOT_PROCEDURE"
  | "NO_ACTIVITIES"
  | "EMPTY_STRUCTURE"
  | "COPIED_PREVIOUS";

export type BulkSigImportResultRow = {
  index: number;
  fileName: string;
  code: string;
  success: boolean;
  documentId?: string;
  versionId?: string;
  error?: string;
  procedureLike?: boolean;
  textIndexStatus?: string | null;
  bootstrapped?: boolean;
  copiedFromPrevious?: boolean;
  activitiesCount?: number;
  conversionStatus?: BulkConversionStatus;
};

export type BulkSigImportResult = {
  total: number;
  created: number;
  failed: number;
  conversionOk: number;
  conversionIssues: number;
  results: BulkSigImportResultRow[];
};

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function deriveConversionStatus(input: {
  procedureLike: boolean;
  textIndexStatus: string | null;
  bootstrapped: boolean;
  copiedFromPrevious: boolean;
  activitiesCount: number;
  hasBodyOrStages: boolean;
}): BulkConversionStatus {
  if (!input.procedureLike) return "NOT_PROCEDURE";
  if (input.textIndexStatus === "FAILED") return "INDEX_FAILED";
  if (input.textIndexStatus === "SKIPPED") return "INDEX_SKIPPED";
  if (input.bootstrapped && input.activitiesCount > 0) return "OK";
  if (input.bootstrapped && !input.activitiesCount) return "NO_ACTIVITIES";
  if (input.copiedFromPrevious) return "COPIED_PREVIOUS";
  if (!input.hasBodyOrStages && !input.activitiesCount) return "EMPTY_STRUCTURE";
  if (input.activitiesCount > 0 || input.hasBodyOrStages) return "OK";
  return "PENDING";
}

export async function bulkCreateSigDocuments(
  shared: BulkSigDocumentShared,
  items: BulkSigDocumentItem[],
  actorId: string
): Promise<BulkSigImportResult> {
  if (items.length === 0) {
    throw new Error("Debe incluir al menos un archivo");
  }

  const docType = await prisma.sigDocumentType.findUnique({
    where: { id: shared.documentTypeId },
    select: { id: true, code: true, name: true },
  });
  if (!docType) throw new Error("Tipo documental no encontrado");
  const procedureLike = isProcedureLikeType(docType);

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
          scheduleTextIndex: false,
        },
        actorId
      );

      const versionId = doc.currentVersion?.id;
      let textIndexStatus: string | null = null;
      let bootstrapped = false;
      let copiedFromPrevious = false;
      let activitiesCount = 0;
      let hasBodyOrStages = false;
      let conversionStatus: BulkConversionStatus = procedureLike ? "PENDING" : "NOT_PROCEDURE";

      if (versionId) {
        const indexed = await indexSigDocumentVersionText(versionId, {
          replaceProcedure: true,
        });
        textIndexStatus = indexed.textIndexStatus;
        bootstrapped = indexed.bootstrapped;
        copiedFromPrevious = indexed.copiedFromPrevious;
        activitiesCount = indexed.activitiesCount;

        const counts = await prisma.sigDocumentVersion.findUnique({
          where: { id: versionId },
          select: {
            procedureBody: { select: { id: true } },
            _count: { select: { procedureStages: true, procedureActivities: true } },
          },
        });
        hasBodyOrStages = Boolean(
          counts?.procedureBody || (counts?._count.procedureStages ?? 0) > 0
        );
        activitiesCount = counts?._count.procedureActivities ?? activitiesCount;

        conversionStatus = deriveConversionStatus({
          procedureLike,
          textIndexStatus,
          bootstrapped,
          copiedFromPrevious,
          activitiesCount,
          hasBodyOrStages,
        });
      }

      results.push({
        index,
        fileName,
        code: doc.code,
        success: true,
        documentId: doc.id,
        versionId: versionId ?? undefined,
        procedureLike,
        textIndexStatus,
        bootstrapped,
        copiedFromPrevious,
        activitiesCount,
        conversionStatus,
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
  const conversionOk = results.filter((r) => r.conversionStatus === "OK").length;
  const conversionIssues = results.filter(
    (r) =>
      r.success &&
      r.conversionStatus &&
      r.conversionStatus !== "OK" &&
      r.conversionStatus !== "NOT_PROCEDURE"
  ).length;

  return {
    total: items.length,
    created,
    failed: items.length - created,
    conversionOk,
    conversionIssues,
    results,
  };
}
