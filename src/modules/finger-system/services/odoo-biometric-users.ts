import {
  getOdooBiometricClient,
  isOdooBiometricConfigured,
  odooBiometricExecute,
  odooBiometricQuery,
} from "@/modules/finger-system/integrations/odoo-biometric/odoo-pg";
import type { UnifiedEmployeeRow } from "@/modules/finger-system/services/finger-unified-employees";
import { createZKTecoAdapter } from "@/modules/finger-system/integrations/biometric/zkteco-adapter";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

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

function mapUser(u: OdooUserRow): UnifiedEmployeeRow {
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
    source: "odoo",
  };
}

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
  return {
    items: rows.map(mapUser),
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

export async function nextOdooBiometricBadge(): Promise<string> {
  const rows = await odooBiometricQuery<{ max: string | null }>`
    SELECT MAX(CAST(badge AS bigint))::text AS max
    FROM alfa_biometric_user
    WHERE badge ~ '^[0-9]+$'
  `;
  const max = Number.parseInt(rows[0]?.max ?? "999", 10);
  return String(Number.isFinite(max) ? max + 1 : 1000);
}

async function assignUserToAllActiveDevices(userId: number) {
  await odooBiometricExecute`
    INSERT INTO alfa_biometric_user_device_rel (user_id, device_id)
    SELECT ${userId}, d.id
    FROM alfa_biometric_device d
    WHERE d.active IS DISTINCT FROM FALSE
    ON CONFLICT (device_id, user_id) DO NOTHING
  `;
}

async function pushUserToZkClocks(params: {
  badge: string;
  name: string;
  privilege?: number;
  pin?: string;
  card?: string;
}) {
  const devices = await odooBiometricQuery<{ ip: string; port: number; name: string }>`
    SELECT ip, port, name FROM alfa_biometric_device WHERE active IS DISTINCT FROM FALSE
  `;
  const results: Array<{ device: string; ok: boolean; message: string }> = [];
  for (const d of devices) {
    try {
      const adapter = createZKTecoAdapter({ ipAddress: d.ip, port: d.port || 4370 });
      const sync = await adapter.sync();
      if (!sync.ok) {
        results.push({ device: d.name, ok: false, message: sync.message });
        continue;
      }
      const set = await adapter.setUser({
        userId: params.badge,
        name: params.name.slice(0, 24),
        privilege: params.privilege ?? 0,
        password: params.pin ?? "",
        card: params.card ? Number.parseInt(params.card, 10) || 0 : 0,
      });
      results.push({ device: d.name, ok: set.ok, message: set.message });
    } catch (e) {
      results.push({
        device: d.name,
        ok: false,
        message: e instanceof Error ? e.message : "Error",
      });
    }
  }
  return results;
}

export async function createOdooBiometricUser(params: {
  badgeNumber?: string;
  name: string;
  identificationId?: string | null;
  privilege?: string;
  pin?: string | null;
  card?: string | null;
  pushToDevices?: boolean;
  userId: string;
  ipAddress?: string | null;
}) {
  const name = params.name.trim();
  if (!name) throw new Error("Nombre obligatorio.");
  const badge = (params.badgeNumber?.trim() || (await nextOdooBiometricBadge())).trim();
  if (!badge) throw new Error("Badge/código obligatorio.");

  const privilege = params.privilege === "14" ? "14" : "0";

  const existing = await odooBiometricQuery<{ id: number }>`
    SELECT id FROM alfa_biometric_user WHERE badge = ${badge} LIMIT 1
  `;
  if (existing[0]) throw new Error(`Ya existe un usuario biométrico con código ${badge}.`);

  const inserted = await getOdooBiometricClient().$queryRaw<{ id: number }[]>`
    INSERT INTO alfa_biometric_user (
      name, badge, identification_id, privilege, pin, card, active, create_date, write_date
    ) VALUES (
      ${name},
      ${badge},
      ${params.identificationId?.trim() || null},
      ${privilege},
      ${params.pin?.trim() || null},
      ${params.card?.trim() || null},
      TRUE,
      (NOW() AT TIME ZONE 'UTC'),
      (NOW() AT TIME ZONE 'UTC')
    )
    RETURNING id
  `;
  const id = inserted[0]?.id;
  if (!id) throw new Error("No se pudo crear el usuario en Odoo.");

  await assignUserToAllActiveDevices(id);

  let pushResults: Array<{ device: string; ok: boolean; message: string }> = [];
  if (params.pushToDevices !== false) {
    pushResults = await pushUserToZkClocks({
      badge,
      name,
      privilege: privilege === "14" ? 14 : 0,
      pin: params.pin ?? undefined,
      card: params.card ?? undefined,
    });
    const err = pushResults.filter((r) => !r.ok).map((r) => `${r.device}: ${r.message}`).join("; ");
    await odooBiometricExecute`
      UPDATE alfa_biometric_user
      SET last_sync_at = (NOW() AT TIME ZONE 'UTC'),
          last_sync_error = ${err || null},
          write_date = (NOW() AT TIME ZONE 'UTC')
      WHERE id = ${id}
    `;
  }

  await logFingerOperation({
    userId: params.userId,
    action: "finger.odoo.user.create",
    entityType: "alfa.biometric.user",
    entityId: String(id),
    ipAddress: params.ipAddress ?? null,
    metadata: { badge, pushResults },
    message: `Usuario biométrico ${badge} creado en Odoo`,
  });

  return {
    id: `odoo-user:${id}`,
    odooId: id,
    attUserId: Number.parseInt(badge, 10) || id,
    badgeNumber: badge,
    name,
    pushResults,
  };
}

export async function updateOdooBiometricUser(params: {
  badgeNumber: string;
  name?: string;
  identificationId?: string | null;
  attEnabled?: boolean;
  userId: string;
  ipAddress?: string | null;
  pushToDevices?: boolean;
}) {
  const badge = params.badgeNumber.trim();
  const rows = await odooBiometricQuery<{ id: number; name: string; pin: string | null; card: string | null; privilege: string }>`
    SELECT id, name, pin, card, privilege FROM alfa_biometric_user WHERE badge = ${badge} LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new Error(`Usuario biométrico ${badge} no encontrado en Odoo.`);

  const name = params.name?.trim() || row.name;
  await odooBiometricExecute`
    UPDATE alfa_biometric_user
    SET name = ${name},
        identification_id = COALESCE(${params.identificationId?.trim() ?? null}, identification_id),
        active = COALESCE(${params.attEnabled ?? null}, active),
        write_date = (NOW() AT TIME ZONE 'UTC')
    WHERE id = ${row.id}
  `;

  let pushResults: Array<{ device: string; ok: boolean; message: string }> = [];
  if (params.pushToDevices) {
    pushResults = await pushUserToZkClocks({
      badge,
      name,
      privilege: row.privilege === "14" ? 14 : 0,
      pin: row.pin ?? undefined,
      card: row.card ?? undefined,
    });
  }

  await logFingerOperation({
    userId: params.userId,
    action: "finger.odoo.user.update",
    entityType: "alfa.biometric.user",
    entityId: String(row.id),
    ipAddress: params.ipAddress ?? null,
    metadata: { badge, pushResults },
    message: `Usuario biométrico ${badge} actualizado`,
  });

  return { id: `odoo-user:${row.id}`, badgeNumber: badge, name, pushResults };
}
