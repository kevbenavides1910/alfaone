import {
  getOdooBiometricClient,
  isOdooBiometricConfigured,
} from "@/modules/finger-system/integrations/odoo-biometric/odoo-pg";
import type { UnifiedEmployeeRow } from "@/modules/finger-system/services/finger-unified-employees";

type OdooUserRow = {
  id: number;
  name: string;
  badge: string;
  identification_id: string | null;
  privilege: string;
  pin: string | null;
  card: string | null;
  active: boolean | null;
  last_sync_at: Date | null;
  last_sync_error: string | null;
  employee_name: string | null;
  total: bigint | number;
};

export async function listOdooBiometricUsers(filters: {
  q?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(500, Math.max(25, filters.pageSize ?? 100));
  const offset = (page - 1) * pageSize;
  const q = filters.q?.trim() || null;
  const like = q ? `%${q}%` : null;

  const client = getOdooBiometricClient();
  const rows = await client.$queryRaw<OdooUserRow[]>`
    SELECT
      u.id, u.name, u.badge, u.identification_id, u.privilege, u.pin, u.card,
      u.active, u.last_sync_at, u.last_sync_error,
      he.name AS employee_name,
      COUNT(*) OVER() AS total
    FROM alfa_biometric_user u
    LEFT JOIN hr_employee he ON he.id = u.employee_id
    WHERE u.active IS DISTINCT FROM FALSE
      AND (
        ${like}::text IS NULL
        OR u.badge ILIKE ${like}
        OR u.name ILIKE ${like}
        OR COALESCE(u.identification_id, '') ILIKE ${like}
        OR COALESCE(he.name, '') ILIKE ${like}
      )
    ORDER BY u.name ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = Number(rows[0]?.total ?? 0);
  const items: UnifiedEmployeeRow[] = rows.map((u) => {
    const attUserId = Number.parseInt(u.badge, 10);
    return {
      id: `odoo-user:${u.id}`,
      employeeId: null,
      attUserId: Number.isFinite(attUserId) ? attUserId : u.id,
      badgeNumber: u.badge,
      name: u.employee_name || u.name,
      cedula: u.identification_id,
      gender: null,
      title: null,
      companyCode: null,
      deptId: null,
      deptName: null,
      attEnabled: u.active !== false,
      fingerprintCount: 0,
      fingerIds: [],
      linkId: null,
      source: "att2016",
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

export async function listUnifiedEmployeesPreferOdoo(filters: {
  q?: string;
  company?: string;
  deptId?: number;
  includeSubDepts?: boolean;
  page?: number;
  pageSize?: number;
}) {
  if (!isOdooBiometricConfigured()) {
    const { listUnifiedEmployees } = await import(
      "@/modules/finger-system/services/finger-unified-employees"
    );
    return { ...(await listUnifiedEmployees(filters)), source: "finger" as const };
  }
  try {
    return await listOdooBiometricUsers({
      q: filters.q,
      page: filters.page,
      pageSize: filters.pageSize ?? 500,
    });
  } catch (e) {
    console.error("[finger] odoo users fallback", e);
    const { listUnifiedEmployees } = await import(
      "@/modules/finger-system/services/finger-unified-employees"
    );
    return { ...(await listUnifiedEmployees(filters)), source: "finger" as const };
  }
}
