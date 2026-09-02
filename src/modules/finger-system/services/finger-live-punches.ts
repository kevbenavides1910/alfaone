import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";
import {
  isOdooBiometricConfigured,
  getOdooBiometricClient,
} from "@/modules/finger-system/integrations/odoo-biometric/odoo-pg";
import { odooWallTimeToClient } from "@/modules/finger-system/integrations/odoo-biometric/odoo-wall-time";

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

async function listRecentOdooPunches(params?: {
  limit?: number;
  hoursBack?: number;
  q?: string;
}): Promise<FingerLivePunchRow[]> {
  const limit = Math.min(100, Math.max(10, params?.limit ?? 30));
  const hoursBack = Math.min(72, Math.max(1, params?.hoursBack ?? 24));
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const q = params?.q?.trim() || null;
  const like = q ? `%${q}%` : null;

  const client = getOdooBiometricClient();
  const rows = await client.$queryRaw<
    Array<{
      id: number;
      check_time: Date;
      badge: string | null;
      check_type: string | null;
      person_name: string | null;
      employee_name: string | null;
      device_name: string | null;
    }>
  >`
    SELECT
      p.id,
      p.check_time,
      p.badge,
      p.check_type,
      p.person_name,
      he.name AS employee_name,
      d.name AS device_name
    FROM alfa_biometric_punch p
    LEFT JOIN hr_employee he ON he.id = p.employee_id
    LEFT JOIN alfa_biometric_device d ON d.id = p.device_id
    WHERE p.check_time >= ${since}
      AND (
        ${like}::text IS NULL
        OR p.badge ILIKE ${like}
        OR COALESCE(p.person_name, '') ILIKE ${like}
        OR COALESCE(he.name, '') ILIKE ${like}
        OR COALESCE(d.name, '') ILIKE ${like}
      )
    ORDER BY p.check_time DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: `odoo:${r.id}`,
    checkTime: odooWallTimeToClient(r.check_time) ?? String(r.check_time),
    badgeNumber: r.badge,
    checkType: r.check_type,
    verifyCode: null,
    deviceSn: r.device_name,
    employeeName: r.employee_name || r.person_name,
    employeeCodigo: r.badge,
  }));
}

export async function listRecentFingerPunches(params?: {
  limit?: number;
  hoursBack?: number;
  q?: string;
  company?: string;
}) {
  if (isOdooBiometricConfigured()) {
    try {
      return await listRecentOdooPunches(params);
    } catch (e) {
      console.error("[finger] odoo recent punches fallback", e);
    }
  }

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
export async function listFingerPunchesAfter(after: Date, limit = 50, _company?: string) {
  if (isOdooBiometricConfigured()) {
    try {
      const client = getOdooBiometricClient();
      const rows = await client.$queryRaw<
        Array<{
          id: number;
          check_time: Date;
          badge: string | null;
          check_type: string | null;
          person_name: string | null;
          employee_name: string | null;
          device_name: string | null;
        }>
      >`
        SELECT
          p.id, p.check_time, p.badge, p.check_type, p.person_name,
          he.name AS employee_name, d.name AS device_name
        FROM alfa_biometric_punch p
        LEFT JOIN hr_employee he ON he.id = p.employee_id
        LEFT JOIN alfa_biometric_device d ON d.id = p.device_id
        WHERE p.check_time > ${after}
        ORDER BY p.check_time ASC
        LIMIT ${Math.min(100, Math.max(1, limit))}
      `;
      return rows.map((r) => ({
        id: `odoo:${r.id}`,
        checkTime: odooWallTimeToClient(r.check_time) ?? String(r.check_time),
        badgeNumber: r.badge,
        checkType: r.check_type,
        verifyCode: null,
        deviceSn: r.device_name,
        employeeName: r.employee_name || r.person_name,
        employeeCodigo: r.badge,
      }));
    } catch (e) {
      console.error("[finger] odoo punches-after fallback", e);
    }
  }

  const rows = await prisma.fingerPunch.findMany({
    where: {
      checkTime: { gt: after },
      ...(_company?.trim() ? { employee: { company: _company.trim().toUpperCase() } } : {}),
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
