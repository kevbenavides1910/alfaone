import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";

export type FingerLivePunchRow = {
  id: string;
  checkTime: string;
  badgeNumber: string | null;
  checkType: string | null;
  verifyCode: number | null;
  deviceSn: string | null;
  employeeName: string | null;
  employeeCodigo: string | null;
};

function mapPunch(row: {
  id: string;
  checkTime: Date;
  badgeNumber: string | null;
  checkType: string | null;
  verifyCode: number | null;
  deviceSn: string | null;
  employee: { nombre: string | null; codigoEmpleado: string } | null;
}): FingerLivePunchRow {
  return {
    id: row.id,
    checkTime: row.checkTime.toISOString(),
    badgeNumber: row.badgeNumber,
    checkType: row.checkType,
    verifyCode: row.verifyCode,
    deviceSn: row.deviceSn,
    employeeName: row.employee?.nombre ?? null,
    employeeCodigo: row.employee?.codigoEmpleado ?? null,
  };
}

const punchSelect = {
  id: true,
  checkTime: true,
  badgeNumber: true,
  checkType: true,
  verifyCode: true,
  deviceSn: true,
  employee: { select: { nombre: true, codigoEmpleado: true } },
} as const;

export async function listRecentFingerPunches(params?: {
  limit?: number;
  hoursBack?: number;
  q?: string;
  company?: string;
}) {
  const limit = Math.min(100, Math.max(10, params?.limit ?? 30));
  const hoursBack = Math.min(72, Math.max(1, params?.hoursBack ?? 24));
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const where: Prisma.FingerPunchWhereInput = {
    checkTime: { gte: since },
  };

  if (params?.company?.trim()) {
    where.employee = { company: params.company.trim().toUpperCase() };
  }

  if (params?.q?.trim()) {
    const q = params.q.trim();
    const searchOr: Prisma.FingerPunchWhereInput[] = [
      { badgeNumber: { contains: q, mode: "insensitive" } },
      { deviceSn: { contains: q, mode: "insensitive" } },
      { employee: { nombre: { contains: q, mode: "insensitive" } } },
      { employee: { codigoEmpleado: { contains: q, mode: "insensitive" } } },
    ];
    if (where.employee) {
      where.AND = [{ employee: where.employee }, { OR: searchOr }];
      delete where.employee;
    } else {
      where.OR = searchOr;
    }
  }

  const rows = await prisma.fingerPunch.findMany({
    where,
    orderBy: { checkTime: "desc" },
    take: limit,
    select: punchSelect,
  });

  return rows.map(mapPunch);
}

/** Marcas con checkTime estrictamente posterior a `after` (para SSE). */
export async function listFingerPunchesAfter(after: Date, limit = 50, company?: string) {
  const rows = await prisma.fingerPunch.findMany({
    where: {
      checkTime: { gt: after },
      ...(company?.trim() ? { employee: { company: company.trim().toUpperCase() } } : {}),
    },
    orderBy: { checkTime: "asc" },
    take: limit,
    select: punchSelect,
  });
  return rows.map(mapPunch);
}

export async function countFingerPunchesSince(since: Date): Promise<number> {
  return prisma.fingerPunch.count({ where: { checkTime: { gte: since } } });
}
