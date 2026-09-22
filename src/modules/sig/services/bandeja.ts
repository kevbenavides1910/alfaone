import type { SigChangeRequestStatus } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { listPendingSigApprovals } from "./documents-list";
import { listSigRevisionReminders } from "./revision-reminders";

const changeRequestInclude = {
  document: {
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      documentType: { select: { name: true } },
    },
  },
  requester: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
  targetStage: { select: { id: true, title: true, sortOrder: true } },
} as const;

/** Solicitudes de cambio abiertas (o filtradas) de todos los documentos. */
export async function listSigChangeRequestsInbox(opts?: {
  status?: SigChangeRequestStatus | "ALL";
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 40));
  const skip = (page - 1) * pageSize;
  const status =
    opts?.status && opts.status !== "ALL"
      ? opts.status
      : ("OPEN" as SigChangeRequestStatus);

  const where =
    opts?.status === "ALL"
      ? {}
      : { status: status ?? "OPEN" };

  const [total, rows] = await Promise.all([
    prisma.sigChangeRequest.count({ where }),
    prisma.sigChangeRequest.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: changeRequestInclude,
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

/** Bandeja unificada: aprobaciones + solicitudes + vigencias. */
export async function getSigBandeja(userId: string, withinDays = 30) {
  const [approvals, changeRequests, revisions] = await Promise.all([
    listPendingSigApprovals(userId, 1, 50),
    listSigChangeRequestsInbox({ status: "OPEN", pageSize: 50 }),
    listSigRevisionReminders(withinDays),
  ]);

  return {
    approvals,
    changeRequests,
    revisions: {
      total: revisions.length,
      overdue: revisions.filter((r) => r.isOverdue).length,
      rows: revisions.slice(0, 50),
    },
  };
}
