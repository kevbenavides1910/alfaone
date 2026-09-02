import { prisma } from "@/modules/core/db/prisma";
import { createZKTecoAdapter } from "@/modules/finger-system/integrations/biometric/zkteco-adapter";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

export async function pullFingerDeviceUsers(params: {
  deviceId: string;
  userId: string;
  ipAddress?: string | null;
}) {
  const device = await prisma.fingerDevice.findUnique({ where: { id: params.deviceId } });
  if (!device) throw new Error("Dispositivo no encontrado.");

  const adapter = createZKTecoAdapter({
    ipAddress: device.ipAddress,
    port: device.port,
  });

  const users = await adapter.getUsers();
  const now = new Date();

  let updatedLinks = 0;
  let createdLinks = 0;
  let unmatched = 0;

  for (const u of users) {
    const badge = String(u.userId || "").trim();
    const uidNum = Number.parseInt(badge, 10);
    const attUserId = Number.isFinite(uidNum) ? uidNum : u.uid;

    const existingLink =
      (await prisma.fingerEmployeeLink.findFirst({
        where: {
          OR: [
            { badgeNumber: badge },
            ...(Number.isFinite(attUserId) ? [{ attUserId }] : []),
          ],
        },
      })) || null;

    if (existingLink) {
      await prisma.fingerEmployeeLink.update({
        where: { id: existingLink.id },
        data: {
          badgeNumber: badge || existingLink.badgeNumber,
          attUserId: attUserId || existingLink.attUserId,
          privilege: u.privilege ?? existingLink.privilege,
          lastSyncAt: now,
        },
      });
      updatedLinks += 1;
      continue;
    }

    const employee =
      (await prisma.employee.findFirst({
        where: {
          OR: [
            { codigoEmpleado: badge },
            { codigoEmpleadoRaw: badge },
            ...(badge ? [{ cedula: badge }] : []),
          ],
        },
      })) || null;

    if (!employee) {
      unmatched += 1;
      continue;
    }

    await prisma.fingerEmployeeLink.create({
      data: {
        employeeId: employee.id,
        badgeNumber: badge,
        attUserId,
        privilege: u.privilege ?? 0,
        company: employee.company,
        lastSyncAt: now,
      },
    });
    createdLinks += 1;
  }

  await prisma.fingerDevice.update({
    where: { id: device.id },
    data: {
      employeeCount: users.length,
      lastSyncAt: now,
      status: "ONLINE",
      lastOnlineAt: now,
    },
  });

  await prisma.fingerSyncLog.create({
    data: {
      deviceId: device.id,
      direction: "PULL",
      status: "SUCCESS",
      operation: "device_pull_users",
      message: `${users.length} usuarios leídos; ${updatedLinks} actualizados, ${createdLinks} creados, ${unmatched} sin empleado RRHH.`,
      triggeredById: params.userId,
      finishedAt: now,
      detailJson: {
        count: users.length,
        updatedLinks,
        createdLinks,
        unmatched,
        sample: users.slice(0, 5),
      },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.device.pull_users",
    entityType: "FingerDevice",
    entityId: device.id,
    ipAddress: params.ipAddress ?? null,
    metadata: { count: users.length, updatedLinks, createdLinks, unmatched },
  });

  return {
    deviceId: device.id,
    count: users.length,
    updatedLinks,
    createdLinks,
    unmatched,
    users: users.slice(0, 50),
  };
}

export async function pullFingerDeviceAttendance(params: {
  deviceId: string;
  userId: string;
  from: Date;
  to: Date;
  ipAddress?: string | null;
}) {
  const device = await prisma.fingerDevice.findUnique({ where: { id: params.deviceId } });
  if (!device) throw new Error("Dispositivo no encontrado.");

  const adapter = createZKTecoAdapter({
    ipAddress: device.ipAddress,
    port: device.port,
  });

  const records = await adapter.getAttendance(params.from, params.to);
  const links = await prisma.fingerEmployeeLink.findMany({
    select: { attUserId: true, badgeNumber: true, employeeId: true },
  });
  const linkByAttUserId = new Map(
    links.filter((l) => l.attUserId != null).map((l) => [l.attUserId!, l]),
  );
  const linkByBadge = new Map(
    links.filter((l) => l.badgeNumber).map((l) => [l.badgeNumber!, l]),
  );

  let inserted = 0;
  let skipped = 0;

  for (const r of records) {
    const link =
      linkByAttUserId.get(r.userId) ||
      linkByBadge.get(String(r.userId)) ||
      null;
    try {
      await prisma.fingerPunch.create({
        data: {
          attUserId: r.userId,
          badgeNumber: link?.badgeNumber ?? String(r.userId),
          checkTime: r.timestamp,
          checkType: String(r.punch),
          verifyCode: r.status,
          deviceSn: device.serialNumber,
          deviceId: device.id,
          source: "DEVICE",
          employeeId: link?.employeeId ?? null,
        },
      });
      inserted++;
    } catch {
      skipped++;
    }
  }

  const now = new Date();
  await prisma.fingerDevice.update({
    where: { id: device.id },
    data: {
      punchCount: { increment: inserted },
      lastSyncAt: now,
      status: "ONLINE",
      lastOnlineAt: now,
    },
  });

  await prisma.fingerSyncLog.create({
    data: {
      deviceId: device.id,
      direction: "PULL",
      status: "SUCCESS",
      operation: "device_pull_attendance",
      message: `${inserted} marcas nuevas (${skipped} duplicadas) desde ${device.name}.`,
      triggeredById: params.userId,
      finishedAt: now,
      detailJson: { inserted, skipped, from: params.from, to: params.to },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.device.pull_attendance",
    entityType: "FingerDevice",
    entityId: device.id,
    ipAddress: params.ipAddress ?? null,
    metadata: { inserted, skipped },
  });

  return { deviceId: device.id, inserted, skipped, totalRead: records.length };
}

/** Pull de marcas desde todos los dispositivos activos (cron / manual). */
export async function pullAllDevicesAttendance(params: {
  userId?: string | null;
  daysBack?: number;
  ipAddress?: string | null;
}) {
  const daysBack = Math.min(14, Math.max(1, params.daysBack ?? 3));
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  from.setHours(0, 0, 0, 0);

  const devices = await prisma.fingerDevice.findMany({ where: { isActive: true } });
  const results: Array<{
    deviceId: string;
    name: string;
    ok: boolean;
    inserted?: number;
    skipped?: number;
    error?: string;
  }> = [];

  for (const device of devices) {
    try {
      const r = await pullFingerDeviceAttendance({
        deviceId: device.id,
        userId: params.userId ?? "system",
        from,
        to,
        ipAddress: params.ipAddress,
      });
      results.push({
        deviceId: device.id,
        name: device.name,
        ok: true,
        inserted: r.inserted,
        skipped: r.skipped,
      });
    } catch (e) {
      results.push({
        deviceId: device.id,
        name: device.name,
        ok: false,
        error: e instanceof Error ? e.message : "Error",
      });
    }
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    results,
    insertedTotal: results.reduce((s, r) => s + (r.inserted ?? 0), 0),
  };
}
