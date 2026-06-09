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

export async function listSigDocuments(filters: SigDocumentsListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.SigDocumentWhereInput = {};
  if (filters.documentTypeId) where.documentTypeId = filters.documentTypeId;
  if (filters.processId) where.processId = filters.processId;
  if (filters.status) where.status = filters.status;
  if (filters.company) where.company = filters.company;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
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

  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    rows,
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
