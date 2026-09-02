import {
  getOdooBiometricClient,
  isOdooBiometricConfigured,
} from "@/modules/finger-system/integrations/odoo-biometric/odoo-pg";
import { odooWallTimeToClient } from "@/modules/finger-system/integrations/odoo-biometric/odoo-wall-time";
import type { FingerAttendanceStatus } from "@prisma/client";
import type { FingerAttendanceDayRow } from "@/modules/finger-system/services/finger-attendance-calc";
import { prisma } from "@/modules/core/db/prisma";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayExclusive(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

type OdooDayAgg = {
  work_date: Date;
  badge: string | null;
  person_name: string | null;
  first_in: Date | null;
  last_out: Date | null;
  punch_count: bigint | number;
  total: bigint | number;
};

/**
 * Asistencia diaria derivada de marcas Odoo (sin depender de finger_punches locales).
 */
export async function listOdooBiometricAttendanceDays(filters: {
  from: Date;
  to: Date;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const from = startOfDay(filters.from);
  const toEnd = endOfDayExclusive(filters.to);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const q = filters.q?.trim() || null;
  const like = q ? `%${q}%` : null;

  const client = getOdooBiometricClient();
  const rows = await client.$queryRaw<OdooDayAgg[]>`
    WITH daily AS (
      SELECT
        date_trunc('day', p.check_time) AS work_date,
        COALESCE(NULLIF(TRIM(p.badge), ''), CAST(p.att_user_id AS text)) AS badge,
        MAX(COALESCE(p.person_name, he.name, u.name)) AS person_name,
        MIN(p.check_time) AS first_in,
        CASE WHEN COUNT(*) > 1 THEN MAX(p.check_time) ELSE NULL END AS last_out,
        COUNT(*)::int AS punch_count
      FROM alfa_biometric_punch p
      LEFT JOIN hr_employee he ON he.id = p.employee_id
      LEFT JOIN alfa_biometric_user u ON u.badge = p.badge
      WHERE p.check_time >= ${from} AND p.check_time < ${toEnd}
      GROUP BY 1, 2
    )
    SELECT
      work_date, badge, person_name, first_in, last_out, punch_count,
      COUNT(*) OVER() AS total
    FROM daily
    WHERE
      ${like}::text IS NULL
      OR badge ILIKE ${like}
      OR COALESCE(person_name, '') ILIKE ${like}
    ORDER BY work_date DESC, person_name ASC NULLS LAST
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = Number(rows[0]?.total ?? 0);
  const items: FingerAttendanceDayRow[] = rows.map((r, idx) => {
    const punchCount = Number(r.punch_count ?? 0);
    let status: FingerAttendanceStatus = "ABSENT";
    if (punchCount === 1) status = "INCOMPLETE";
    else if (punchCount >= 2) status = "PRESENT";

    const firstIn = r.first_in ? new Date(r.first_in) : null;
    const lastOut = r.last_out ? new Date(r.last_out) : null;
    const workedMinutes =
      firstIn && lastOut
        ? Math.max(0, Math.round((lastOut.getTime() - firstIn.getTime()) / 60_000))
        : null;

    return {
      id: `odoo-att:${r.badge}:${r.work_date instanceof Date ? odooWallTimeToClient(r.work_date)?.slice(0, 10) : String(r.work_date).slice(0, 10)}:${idx}`,
      workDate:
        r.work_date instanceof Date
          ? (odooWallTimeToClient(r.work_date)?.slice(0, 10) ?? String(r.work_date).slice(0, 10))
          : String(r.work_date).slice(0, 10),
      employeeId: `badge:${r.badge}`,
      employeeName: r.person_name,
      employeeCodigo: r.badge ?? "",
      status,
      firstIn: odooWallTimeToClient(firstIn),
      lastOut: odooWallTimeToClient(lastOut),
      workedMinutes,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      punchCount,
      shiftName: "Odoo (marcas)",
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    source: "odoo" as const,
  };
}

/**
 * Copia marcas Odoo → finger_punches (cache) enlazando por badge a FingerEmployeeLink.
 */
export async function syncOdooPunchesIntoFingerCache(params: { from: Date; to: Date }) {
  if (!isOdooBiometricConfigured()) return { inserted: 0, skipped: 0 };

  const from = startOfDay(params.from);
  const toEnd = endOfDayExclusive(params.to);
  const client = getOdooBiometricClient();
  const punches = await client.$queryRaw<
    Array<{
      att_user_id: number;
      badge: string | null;
      check_time: Date;
      check_type: string | null;
      device_id: number | null;
      device_ip: string | null;
    }>
  >`
    SELECT p.att_user_id, p.badge, p.check_time, p.check_type, p.device_id, d.ip AS device_ip
    FROM alfa_biometric_punch p
    LEFT JOIN alfa_biometric_device d ON d.id = p.device_id
    WHERE p.check_time >= ${from} AND p.check_time < ${toEnd}
  `;

  const links = await prisma.fingerEmployeeLink.findMany({
    select: { attUserId: true, badgeNumber: true, employeeId: true },
  });
  const byBadge = new Map(links.filter((l) => l.badgeNumber).map((l) => [l.badgeNumber!, l]));
  const byAtt = new Map(links.filter((l) => l.attUserId != null).map((l) => [l.attUserId!, l]));

  const devices = await prisma.fingerDevice.findMany({ select: { id: true, ipAddress: true } });
  const deviceByIp = new Map(devices.map((d) => [d.ipAddress, d.id]));

  let inserted = 0;
  let skipped = 0;
  for (const p of punches) {
    const badge = (p.badge || String(p.att_user_id)).trim();
    const link = byBadge.get(badge) || byAtt.get(p.att_user_id) || null;
    const deviceId = p.device_ip ? deviceByIp.get(p.device_ip) ?? null : null;
    try {
      await prisma.fingerPunch.create({
        data: {
          attUserId: p.att_user_id,
          badgeNumber: badge,
          checkTime: p.check_time,
          checkType: p.check_type,
          deviceId,
          source: "DEVICE",
          employeeId: link?.employeeId ?? null,
        },
      });
      inserted += 1;
    } catch {
      skipped += 1;
    }
  }
  return { inserted, skipped };
}

export async function listFingerAttendancePreferOdoo(filters: {
  from: Date;
  to: Date;
  q?: string;
  company?: string;
  status?: FingerAttendanceStatus;
  page?: number;
  pageSize?: number;
}) {
  if (isOdooBiometricConfigured()) {
    try {
      return await listOdooBiometricAttendanceDays(filters);
    } catch (e) {
      console.error("[finger] odoo attendance fallback", e);
    }
  }
  const { listFingerAttendanceDays } = await import(
    "@/modules/finger-system/services/finger-attendance-calc"
  );
  return { ...(await listFingerAttendanceDays(filters)), source: "finger" as const };
}
