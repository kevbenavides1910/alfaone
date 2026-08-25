import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";

export type FingerAuditLogRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  result: string;
  message: string | null;
  ipAddress: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
};

export type FingerSyncLogRow = {
  id: string;
  direction: string;
  status: string;
  operation: string;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
  deviceName: string | null;
  triggeredByName: string | null;
};

export async function listFingerOperationLogs(filters: {
  q?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.FingerOperationLogWhereInput = {};
  if (filters.action?.trim()) {
    where.action = { contains: filters.action.trim(), mode: "insensitive" };
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { entityType: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
      { message: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.fingerOperationLog.count({ where }),
    prisma.fingerOperationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        result: true,
        message: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const items: FingerAuditLogRow[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    result: r.result,
    message: r.message,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt.toISOString(),
    userName: r.user?.name ?? null,
    userEmail: r.user?.email ?? null,
  }));

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listFingerSyncLogs(filters: {
  operation?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.FingerSyncLogWhereInput = {};
  if (filters.operation?.trim()) {
    where.operation = { contains: filters.operation.trim(), mode: "insensitive" };
  }
  if (filters.status?.trim()) {
    where.status = filters.status.trim() as import("@prisma/client").FingerSyncStatus;
  }

  const [total, rows] = await Promise.all([
    prisma.fingerSyncLog.count({ where }),
    prisma.fingerSyncLog.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        direction: true,
        status: true,
        operation: true,
        message: true,
        startedAt: true,
        finishedAt: true,
        device: { select: { name: true } },
        triggeredBy: { select: { name: true } },
      },
    }),
  ]);

  const items: FingerSyncLogRow[] = rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    status: r.status,
    operation: r.operation,
    message: r.message,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    deviceName: r.device?.name ?? null,
    triggeredByName: r.triggeredBy?.name ?? null,
  }));

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listDistinctFingerAuditActions(limit = 30): Promise<string[]> {
  const rows = await prisma.fingerOperationLog.findMany({
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
    take: limit,
  });
  return rows.map((r) => r.action);
}
