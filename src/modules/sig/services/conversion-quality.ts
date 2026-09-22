import { prisma } from "@/modules/core/db/prisma";
import { isProcedureLikeType } from "./procedure-content";
import { indexSigDocumentVersionText } from "./text-index";
import { tryAutoBootstrapProcedureVersion } from "./procedure-content";

export type ConversionQualityItem = {
  documentId: string;
  versionId: string;
  code: string;
  title: string;
  versionLabel: string;
  documentType: { code: string; name: string };
  textIndexStatus: string;
  textIndexedAt: string | null;
  activitiesCount: number;
  stagesCount: number;
  issue:
    | "INDEX_PENDING"
    | "INDEX_FAILED"
    | "INDEX_SKIPPED"
    | "NO_ACTIVITIES"
    | "EMPTY_STRUCTURE";
};

/** Cola de calidad: indexación fallida/pendiente o conversión incompleta. */
export async function listSigConversionQualityQueue(): Promise<ConversionQualityItem[]> {
  const versions = await prisma.sigDocumentVersion.findMany({
    where: {
      document: { status: { not: "OBSOLETE" } },
      OR: [
        { textIndexStatus: { in: ["PENDING", "FAILED", "SKIPPED"] } },
        {
          textIndexStatus: "DONE",
          document: {
            documentType: {
              OR: [
                { code: { contains: "proc", mode: "insensitive" } },
                { name: { contains: "procedimiento", mode: "insensitive" } },
                { name: { contains: "manual", mode: "insensitive" } },
                { name: { contains: "instructivo", mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      versionLabel: true,
      textIndexStatus: true,
      textIndexedAt: true,
      documentId: true,
      document: {
        select: {
          id: true,
          code: true,
          title: true,
          documentType: { select: { code: true, name: true } },
        },
      },
      _count: {
        select: { procedureActivities: true, procedureStages: true },
      },
      procedureStages: {
        where: { body: { not: "" } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const items: ConversionQualityItem[] = [];

  for (const v of versions) {
    const type = v.document.documentType;
    const procedureLike = isProcedureLikeType(type);
    const activitiesCount = v._count.procedureActivities;
    const stagesCount = v._count.procedureStages;
    const hasProse = v.procedureStages.length > 0;

    let issue: ConversionQualityItem["issue"] | null = null;
    if (v.textIndexStatus === "PENDING") issue = "INDEX_PENDING";
    else if (v.textIndexStatus === "FAILED") issue = "INDEX_FAILED";
    else if (v.textIndexStatus === "SKIPPED" && procedureLike) issue = "INDEX_SKIPPED";
    else if (v.textIndexStatus === "DONE" && procedureLike) {
      if (activitiesCount === 0) issue = "NO_ACTIVITIES";
      else if (!hasProse && stagesCount === 0) issue = "EMPTY_STRUCTURE";
    }

    if (!issue) continue;

    items.push({
      documentId: v.documentId,
      versionId: v.id,
      code: v.document.code,
      title: v.document.title,
      versionLabel: v.versionLabel,
      documentType: type,
      textIndexStatus: v.textIndexStatus,
      textIndexedAt: v.textIndexedAt?.toISOString() ?? null,
      activitiesCount,
      stagesCount,
      issue,
    });
  }

  const order: Record<ConversionQualityItem["issue"], number> = {
    INDEX_FAILED: 0,
    INDEX_PENDING: 1,
    INDEX_SKIPPED: 2,
    EMPTY_STRUCTURE: 3,
    NO_ACTIVITIES: 4,
  };
  return items.sort((a, b) => order[a.issue] - order[b.issue]);
}

/** Reindexa texto de una versión y, si aplica, intenta conversión Alfa. */
export async function reindexSigDocumentVersion(versionId: string) {
  await indexSigDocumentVersionText(versionId);
  const bootstrapped = await tryAutoBootstrapProcedureVersion(versionId);
  const version = await prisma.sigDocumentVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      textIndexStatus: true,
      textIndexedAt: true,
      documentId: true,
      _count: { select: { procedureActivities: true, procedureStages: true } },
    },
  });
  return { version, bootstrapped };
}
