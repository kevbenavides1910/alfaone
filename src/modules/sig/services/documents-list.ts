import { Prisma, type SigDocumentStatus } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { parseColumnMultiFilter } from "@/lib/table/column-filters";
import { SIG_DOCUMENT_STATUS_LABELS } from "@/modules/sig/business/document-labels";

export type SigDocumentsListFilters = {
  q?: string;
  documentTypeId?: string;
  processId?: string;
  status?: SigDocumentStatus;
  company?: string;
  page?: number;
  pageSize?: number;
  /** Texto de columnas: se aplican al listado completo, antes de paginar. */
  code?: string;
  title?: string;
  typeName?: string;
  /** true = coincidencia exacta del nombre (select). false = contiene. */
  typeNameExact?: boolean;
  processName?: string;
  processNameExact?: boolean;
  version?: string;
  /** Fragmento de la fecha visible dd/MM/yyyy. */
  revision?: string;
  statusLabel?: string;
  statusLabelExact?: boolean;
};

const userSelect = { id: true, name: true, email: true } as const;

/** Prisma rechaza `in: []`. Un id imposible deja el listado vacío. */
const NO_MATCH: Prisma.SigDocumentWhereInput = { id: "__no_match__" };

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

  const and: Prisma.SigDocumentWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
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
      ],
    });
  }

  const code = filters.code?.trim();
  if (code) and.push({ code: { contains: code, mode: "insensitive" } });

  const title = filters.title?.trim();
  if (title) and.push({ title: { contains: title, mode: "insensitive" } });

  const typeClause = relationNameClause("documentType", filters.typeName, filters.typeNameExact === true);
  if (typeClause) and.push(typeClause);

  const processClause = relationNameClause(
    "process",
    filters.processName,
    filters.processNameExact === true
  );
  if (processClause) and.push(processClause);

  const version = filters.version?.trim();
  if (version) {
    and.push({
      currentVersion: {
        is: { versionLabel: { contains: version, mode: "insensitive" } },
      },
    });
  }

  const statusClause = statusLabelClause(filters.statusLabel, filters.statusLabelExact === true);
  if (statusClause) and.push(statusClause);

  const revisionIds = await documentIdsByRevisionText(filters.revision);
  if (revisionIds) {
    and.push(revisionIds.length === 0 ? NO_MATCH : { id: { in: revisionIds } });
  }

  if (and.length > 0) where.AND = and;

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

function relationNameClause(
  relation: "documentType" | "process",
  raw: string | undefined,
  exact: boolean
): Prisma.SigDocumentWhereInput | null {
  const terms = parseColumnMultiFilter(raw ?? "");
  if (terms.length === 0) return null;
  const useExact = exact || terms.length > 1;
  if (!useExact) {
    const contains = { contains: terms[0], mode: "insensitive" as const };
    return relation === "documentType"
      ? { documentType: { name: contains } }
      : { process: { is: { name: contains } } };
  }
  return {
    OR: terms.map((name) => {
      const equals = { equals: name, mode: "insensitive" as const };
      return relation === "documentType"
        ? { documentType: { name: equals } }
        : { process: { is: { name: equals } } };
    }),
  };
}

function statusLabelClause(
  raw: string | undefined,
  exact: boolean
): Prisma.SigDocumentWhereInput | null {
  const terms = parseColumnMultiFilter(raw ?? "");
  if (terms.length === 0) return null;
  const useExact = exact || terms.length > 1;
  const matched = new Set<SigDocumentStatus>();
  for (const term of terms) {
    const needle = term.toLowerCase();
    for (const [key, label] of Object.entries(SIG_DOCUMENT_STATUS_LABELS)) {
      const labelText = label.toLowerCase();
      const keyText = key.toLowerCase();
      const hit = useExact
        ? labelText === needle || keyText === needle
        : labelText.includes(needle) || keyText.includes(needle);
      if (hit) matched.add(key as SigDocumentStatus);
    }
  }
  if (matched.size === 0) return NO_MATCH;
  return { status: { in: [...matched] } };
}

/** null = sin filtro. [] = el texto no coincide con ninguna fecha visible. */
async function documentIdsByRevisionText(raw: string | undefined): Promise<string[] | null> {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const safe = trimmed.replace(/-/g, "/").replace(/[%_\\]/g, "");
  if (!safe) return [];
  const pattern = `%${safe}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT d.id
    FROM sig_documents d
    INNER JOIN sig_document_versions v ON v.id = d."currentVersionId"
    WHERE to_char(v."revisionDate", 'DD/MM/YYYY') ILIKE ${pattern}
  `);
  return rows.map((row) => row.id);
}
