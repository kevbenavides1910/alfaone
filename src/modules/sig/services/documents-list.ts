import type { Prisma, SigDocumentStatus } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

export type SigDocumentsListFilters = {
  q?: string;
  documentTypeId?: string;
  processId?: string;
  status?: SigDocumentStatus;
  company?: string;
  page?: number;
  pageSize?: number;
};

const userSelect = { id: true, name: true, email: true } as const;

function buildSnippet(text: string, q: string, radius = 70): string {
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) {
    const cut = text.slice(0, 140).replace(/\s+/g, " ").trim();
    return cut.length < text.length ? `${cut}…` : cut;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + needle.length + radius);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

export async function listSigDocuments(filters: SigDocumentsListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;
  const q = filters.q?.trim() || "";

  const where: Prisma.SigDocumentWhereInput = {};
  if (filters.documentTypeId) where.documentTypeId = filters.documentTypeId;
  if (filters.processId) where.processId = filters.processId;
  if (filters.status) where.status = filters.status;
  if (filters.company) where.company = filters.company;
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      {
        versions: {
          some: {
            textIndexStatus: "DONE",
            extractedText: { contains: q, mode: "insensitive" },
          },
        },
      },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.sigDocument.count({ where }),
    prisma.sigDocument.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        documentType: { select: { id: true, code: true, name: true } },
        process: { select: { id: true, code: true, name: true } },
        companyEntity: { select: { code: true, name: true } },
        createdBy: { select: userSelect },
        currentVersion: {
          select: {
            id: true,
            versionNumber: true,
            versionLabel: true,
            fileName: true,
            mimeType: true,
            revisionDate: true,
            effectiveFrom: true,
            effectiveUntil: true,
            status: true,
            approvedAt: true,
            approvedBy: { select: userSelect },
          },
        },
      },
    }),
  ]);

  let snippetByDocId = new Map<
    string,
    { snippet: string; matchedIn: "code" | "title" | "content"; matchedVersionId: string | null }
  >();

  if (q && rows.length) {
    const ids = rows.map((r) => r.id);
    const contentHits = await prisma.sigDocumentVersion.findMany({
      where: {
        documentId: { in: ids },
        textIndexStatus: "DONE",
        extractedText: { contains: q, mode: "insensitive" },
      },
      select: { id: true, documentId: true, extractedText: true, versionNumber: true },
      orderBy: { versionNumber: "desc" },
    });

    const bestContent = new Map<string, { id: string; text: string }>();
    for (const hit of contentHits) {
      if (!hit.extractedText || bestContent.has(hit.documentId)) continue;
      bestContent.set(hit.documentId, { id: hit.id, text: hit.extractedText });
    }

    for (const row of rows) {
      if (row.code.toLowerCase().includes(q.toLowerCase())) {
        snippetByDocId.set(row.id, {
          snippet: row.code,
          matchedIn: "code",
          matchedVersionId: row.currentVersion?.id ?? null,
        });
        continue;
      }
      if (row.title.toLowerCase().includes(q.toLowerCase())) {
        snippetByDocId.set(row.id, {
          snippet: row.title.slice(0, 160),
          matchedIn: "title",
          matchedVersionId: row.currentVersion?.id ?? null,
        });
        continue;
      }
      const content = bestContent.get(row.id);
      if (content) {
        snippetByDocId.set(row.id, {
          snippet: buildSnippet(content.text, q),
          matchedIn: "content",
          matchedVersionId: content.id,
        });
      }
    }
  }

  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    rows: rows.map((r) => ({
      ...r,
      searchMatch: snippetByDocId.get(r.id) ?? null,
    })),
  };
}

export async function listPendingSigApprovals(approverUserId: string, page = 1, pageSize = 25) {
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, pageSize));
  const take = Math.min(100, Math.max(1, pageSize));

  const versionWhere = {
    status: "PENDING_APPROVAL" as const,
    assignedApproverId: approverUserId,
  };

  const where: Prisma.SigDocumentWhereInput = {
    status: "PENDING_APPROVAL",
    versions: { some: versionWhere },
  };

  const [total, rows] = await Promise.all([
    prisma.sigDocument.count({ where }),
    prisma.sigDocument.findMany({
      where,
      skip,
      take,
      orderBy: [{ updatedAt: "asc" }],
      include: {
        documentType: { select: { id: true, code: true, name: true } },
        process: { select: { id: true, code: true, name: true } },
        createdBy: { select: userSelect },
        versions: {
          where: versionWhere,
          orderBy: { versionNumber: "desc" },
          take: 1,
          include: {
            uploadedBy: { select: userSelect },
            assignedApprover: { select: userSelect },
          },
        },
      },
    }),
  ]);

  return { total, page, pageSize: take, totalPages: Math.ceil(total / take) || 1, rows };
}
