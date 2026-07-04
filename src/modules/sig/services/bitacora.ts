import type { Prisma, SigAuditAction } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

export type SigBitacoraFilters = {
  documentId?: string;
  action?: SigAuditAction;
  actorId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listSigBitacora(filters: SigBitacoraFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 30));
  const skip = (page - 1) * pageSize;

  const where: Prisma.SigDocumentAuditLogWhereInput = {};
  if (filters.documentId) where.documentId = filters.documentId;
  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }

  const [total, rows] = await Promise.all([
    prisma.sigDocumentAuditLog.count({ where }),
    prisma.sigDocumentAuditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        document: { select: { id: true, code: true, title: true } },
        version: {
          select: {
            id: true,
            versionNumber: true,
            versionLabel: true,
          },
        },
        actor: { select: { id: true, name: true, email: true } },
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
