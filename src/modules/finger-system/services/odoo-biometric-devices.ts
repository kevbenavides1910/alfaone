import {
  isOdooBiometricConfigured,
  odooBiometricQuery,
  getOdooBiometricClient,
} from "@/modules/finger-system/integrations/odoo-biometric/odoo-pg";
import { prisma } from "@/modules/core/db/prisma";
import type { FingerDeviceRow } from "@/modules/finger-system/services/finger-devices";
import type { FingerDeviceStatus } from "@prisma/client";

type OdooDeviceAgg = {
  id: number;
  name: string;
  ip: string;
  port: number;
  location: string | null;
  active: boolean | null;
  last_status: string | null;
  last_probe_at: Date | null;
  last_error: string | null;
  punch_count: bigint | number;
  user_count: bigint | number;
  total: bigint | number;
};

function mapOdooStatus(raw: string | null): FingerDeviceStatus {
  const s = (raw || "").toLowerCase();
  if (s.includes("online") || s === "ok" || s === "connected") return "ONLINE";
  if (s.includes("error")) return "ERROR";
  if (s.includes("offline") || s.includes("fail")) return "OFFLINE";
  return "UNKNOWN";
}

export async function listOdooBiometricDevices(filters: {
  q?: string;
  page?: number;
  pageSize?: number;
  onlyActive?: boolean;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const q = filters.q?.trim() ?? "";
  const like = q ? `%${q}%` : null;

  const client = getOdooBiometricClient();
  const rows = await client.$queryRaw<OdooDeviceAgg[]>`
    SELECT
      d.id, d.name, d.ip, d.port, d.location, d.active,
      d.last_status, d.last_probe_at, d.last_error,
      (SELECT COUNT(*) FROM alfa_biometric_punch p WHERE p.device_id = d.id) AS punch_count,
      (SELECT COUNT(*) FROM alfa_biometric_user_device_rel r WHERE r.device_id = d.id) AS user_count,
      COUNT(*) OVER() AS total
    FROM alfa_biometric_device d
    WHERE
      (${like}::text IS NULL OR d.name ILIKE ${like} OR d.ip ILIKE ${like} OR COALESCE(d.location, '') ILIKE ${like})
      AND (${filters.onlyActive === true} IS NOT TRUE OR d.active IS TRUE)
    ORDER BY d.name ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = Number(rows[0]?.total ?? 0);
  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      ip: r.ip,
      port: r.port,
      location: r.location,
      active: r.active !== false,
      lastStatus: r.last_status,
      lastProbeAt: r.last_probe_at
        ? r.last_probe_at instanceof Date
          ? r.last_probe_at.toISOString()
          : String(r.last_probe_at)
        : null,
      lastError: r.last_error,
      punchCount: Number(r.punch_count ?? 0),
      userCount: Number(r.user_count ?? 0),
    })),
  };
}

/**
 * Asegura un FingerDevice local espejo (por IP) para operaciones ZK (connect/pull/push).
 */
export async function listFingerDevicesPreferOdoo(filters: {
  q?: string;
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}): Promise<{
  items: FingerDeviceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  source: "odoo" | "finger";
}> {
  if (!isOdooBiometricConfigured()) {
    const { listFingerDevices } = await import("@/modules/finger-system/services/finger-devices");
    const data = await listFingerDevices(filters);
    return { ...data, source: "finger" };
  }

  try {
    const odoo = await listOdooBiometricDevices({
      q: filters.q,
      page: filters.page,
      pageSize: filters.pageSize,
      onlyActive: filters.isActive === true ? true : undefined,
    });

    const items: FingerDeviceRow[] = [];
    for (const d of odoo.items) {
      const existing = await prisma.fingerDevice.findFirst({ where: { ipAddress: d.ip } });
      const status = mapOdooStatus(d.lastStatus);
      const mirrored = existing
        ? await prisma.fingerDevice.update({
            where: { id: existing.id },
            data: {
              name: d.name,
              port: d.port || 4370,
              location: d.location,
              brand: existing.brand ?? "ZKTeco",
              isActive: d.active,
              status: existing.status === "ONLINE" ? "ONLINE" : status,
              lastOnlineAt: d.lastProbeAt ? new Date(d.lastProbeAt) : existing.lastOnlineAt,
              punchCount: d.punchCount,
              employeeCount: d.userCount,
            },
          })
        : await prisma.fingerDevice.create({
            data: {
              name: d.name,
              ipAddress: d.ip,
              port: d.port || 4370,
              location: d.location,
              brand: "ZKTeco",
              isActive: d.active,
              status,
              lastOnlineAt: d.lastProbeAt ? new Date(d.lastProbeAt) : null,
              punchCount: d.punchCount,
              employeeCount: d.userCount,
            },
          });

      items.push({
        id: mirrored.id,
        name: mirrored.name,
        ipAddress: mirrored.ipAddress,
        port: mirrored.port,
        brand: mirrored.brand,
        model: mirrored.model,
        serialNumber: mirrored.serialNumber,
        company: mirrored.company,
        location: mirrored.location,
        description: mirrored.description,
        status: mirrored.status,
        lastOnlineAt: mirrored.lastOnlineAt?.toISOString() ?? null,
        lastSyncAt: mirrored.lastSyncAt?.toISOString() ?? null,
        employeeCount: d.userCount,
        fingerprintCount: mirrored.fingerprintCount,
        punchCount: d.punchCount,
        isActive: mirrored.isActive,
        createdAt: mirrored.createdAt.toISOString(),
        updatedAt: mirrored.updatedAt.toISOString(),
      });
    }

    return {
      items,
      total: odoo.total,
      page: odoo.page,
      pageSize: odoo.pageSize,
      totalPages: odoo.totalPages,
      source: "odoo",
    };
  } catch (e) {
    console.error("[finger] odoo devices fallback", e);
    const { listFingerDevices } = await import("@/modules/finger-system/services/finger-devices");
    const data = await listFingerDevices(filters);
    return { ...data, source: "finger" };
  }
}

export async function findOdooDeviceIdByIp(ip: string): Promise<number | null> {
  if (!isOdooBiometricConfigured()) return null;
  const rows = await odooBiometricQuery<{ id: number }>`
    SELECT id FROM alfa_biometric_device WHERE ip = ${ip} LIMIT 1
  `;
  return rows[0]?.id ?? null;
}
