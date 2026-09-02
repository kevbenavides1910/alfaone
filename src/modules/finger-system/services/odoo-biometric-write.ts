import {
  isOdooBiometricConfigured,
  odooBiometricExecute,
  odooBiometricQuery,
} from "@/modules/finger-system/integrations/odoo-biometric/odoo-pg";
import { findOdooDeviceIdByIp } from "@/modules/finger-system/services/odoo-biometric-devices";

export type OdooPunchInsert = {
  attUserId: number;
  badge?: string | null;
  personName?: string | null;
  checkTime: Date;
  checkType?: string | null;
  sensorId?: number | null;
  odooDeviceId?: number | null;
};

/**
 * Inserta marcas en alfa_biometric_punch (ON CONFLICT DO NOTHING).
 * source = 'device' (paridad Odoo).
 */
export async function upsertOdooBiometricPunches(
  rows: OdooPunchInsert[],
): Promise<{ inserted: number; skipped: number }> {
  if (!isOdooBiometricConfigured() || !rows.length) {
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (const r of rows) {
    try {
      const n = await odooBiometricExecute`
        INSERT INTO alfa_biometric_punch (
          att_user_id, badge, person_name, check_time, check_type,
          sensor_id, device_id, source, create_date, write_date
        ) VALUES (
          ${r.attUserId},
          ${r.badge ?? String(r.attUserId)},
          ${r.personName ?? null},
          ${r.checkTime},
          ${r.checkType ?? null},
          ${r.sensorId ?? null},
          ${r.odooDeviceId ?? null},
          'device',
          NOW() AT TIME ZONE 'UTC',
          NOW() AT TIME ZONE 'UTC'
        )
        ON CONFLICT (att_user_id, check_time, source) DO NOTHING
      `;
      if (n > 0) inserted += 1;
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }

  return { inserted, skipped };
}

export async function resolveOdooDeviceIdForFingerIp(ip: string): Promise<number | null> {
  return findOdooDeviceIdByIp(ip);
}

export async function updateOdooUserLastSync(badge: string, error: string | null) {
  if (!isOdooBiometricConfigured() || !badge.trim()) return;
  await odooBiometricExecute`
    UPDATE alfa_biometric_user
    SET last_sync_at = NOW() AT TIME ZONE 'UTC',
        last_sync_error = ${error},
        write_date = NOW() AT TIME ZONE 'UTC'
    WHERE badge = ${badge.trim()}
  `;
}

export async function countOdooBiometricSummary() {
  if (!isOdooBiometricConfigured()) return null;
  const rows = await odooBiometricQuery<{
    devices: bigint | number;
    users: bigint | number;
    punches: bigint | number;
  }>`
    SELECT
      (SELECT COUNT(*) FROM alfa_biometric_device WHERE active IS DISTINCT FROM FALSE) AS devices,
      (SELECT COUNT(*) FROM alfa_biometric_user WHERE active IS DISTINCT FROM FALSE) AS users,
      (SELECT COUNT(*) FROM alfa_biometric_punch) AS punches
  `;
  const r = rows[0];
  return {
    devices: Number(r?.devices ?? 0),
    users: Number(r?.users ?? 0),
    punches: Number(r?.punches ?? 0),
  };
}
