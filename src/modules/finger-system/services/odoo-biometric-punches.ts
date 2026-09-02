import {
  getOdooBiometricClient,
  isOdooBiometricConfigured,
} from "@/modules/finger-system/integrations/odoo-biometric/odoo-pg";
import type { FingerPunchListInput, FingerPunchListRow } from "@/modules/finger-system/services/finger-punches-list";

type OdooPunchRow = {
  id: number;
  check_time: Date;
  att_user_id: number;
  badge: string | null;
  check_type: string | null;
  source: string;
  device_id: number | null;
  device_name: string | null;
  person_name: string | null;
  employee_name: string | null;
  total: bigint | number;
};

export async function listOdooBiometricPunches(input: FingerPunchListInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const q = input.q?.trim() || null;
  const like = q ? `%${q}%` : null;
  const badge = input.badgeNumber?.trim() || null;
  // Odoo guarda check_time como hora local naive; filtrar por fecha civil, no Instant UTC.
  const fromDate = input.from?.trim() || null;
  const toDate = input.to?.trim() || null;
  const source =
    input.source === "DEVICE" ? "device" : input.source === "ATT2016" ? "att2016" : null;
  const deviceIdNum = input.deviceId && /^\d+$/.test(input.deviceId) ? Number(input.deviceId) : null;

  const client = getOdooBiometricClient();
  const rows = await client.$queryRaw<OdooPunchRow[]>`
    SELECT
      p.id,
      p.check_time,
      p.att_user_id,
      p.badge,
      p.check_type,
      p.source,
      p.device_id,
      d.name AS device_name,
      p.person_name,
      he.name AS employee_name,
      COUNT(*) OVER() AS total
    FROM alfa_biometric_punch p
    LEFT JOIN alfa_biometric_device d ON d.id = p.device_id
    LEFT JOIN hr_employee he ON he.id = p.employee_id
    WHERE
      (${like}::text IS NULL
        OR p.badge ILIKE ${like}
        OR COALESCE(p.person_name, '') ILIKE ${like}
        OR COALESCE(he.name, '') ILIKE ${like}
        OR COALESCE(d.name, '') ILIKE ${like}
        OR CAST(p.att_user_id AS text) = ${q})
      AND (${badge}::text IS NULL OR p.badge ILIKE ${badge ? `%${badge}%` : null})
      AND (${source}::text IS NULL OR p.source = ${source})
      AND (${fromDate}::date IS NULL OR p.check_time::date >= ${fromDate}::date)
      AND (${toDate}::date IS NULL OR p.check_time::date <= ${toDate}::date)
      AND (${deviceIdNum}::int IS NULL OR p.device_id = ${deviceIdNum})
    ORDER BY p.check_time DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = Number(rows[0]?.total ?? 0);
  const mapped: FingerPunchListRow[] = rows.map((r) => ({
    id: `odoo:${r.id}`,
    checkTime: r.check_time instanceof Date ? r.check_time.toISOString() : String(r.check_time),
    attUserId: r.att_user_id,
    badgeNumber: r.badge,
    checkType: r.check_type,
    verifyCode: null,
    source: r.source === "device" ? "DEVICE" : r.source === "att2016" ? "ATT2016" : r.source,
    deviceId: r.device_id != null ? String(r.device_id) : null,
    deviceName: r.device_name,
    deviceSn: null,
    employeeId: null,
    employeeName: r.employee_name || r.person_name,
    employeeCodigo: r.badge,
  }));

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    rows: mapped,
    source: "odoo" as const,
  };
}

export async function listFingerPunchesPreferOdoo(input: FingerPunchListInput = {}) {
  if (!isOdooBiometricConfigured()) {
    const { listFingerPunches } = await import("@/modules/finger-system/services/finger-punches-list");
    return { ...(await listFingerPunches(input)), source: "finger" as const };
  }
  try {
    return await listOdooBiometricPunches(input);
  } catch (e) {
    console.error("[finger] odoo punches fallback", e);
    const { listFingerPunches } = await import("@/modules/finger-system/services/finger-punches-list");
    return { ...(await listFingerPunches(input)), source: "finger" as const };
  }
}
