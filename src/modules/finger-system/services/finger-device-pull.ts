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

      message: `${users.length} usuarios leídos desde ${device.name}.`,

      triggeredById: params.userId,

      finishedAt: now,

      detailJson: { count: users.length, sample: users.slice(0, 5) },

    },

  });



  await logFingerOperation({

    userId: params.userId,

    action: "finger.device.pull_users",

    entityType: "FingerDevice",

    entityId: device.id,

    ipAddress: params.ipAddress ?? null,

    metadata: { count: users.length },

  });



  return { deviceId: device.id, count: users.length, users: users.slice(0, 20) };

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



  let inserted = 0;

  let skipped = 0;



  for (const r of records) {

    const link = linkByAttUserId.get(r.userId);

    try {

      await prisma.fingerPunch.create({

        data: {

          attUserId: r.userId,

          badgeNumber: link?.badgeNumber ?? null,

          checkTime: r.timestamp,

          checkType: String(r.punch),

          verifyCode: r.status,

          deviceSn: device.serialNumber,

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

      punchCount: device.punchCount + inserted,

      lastSyncAt: now,

      status: "ONLINE",

      lastOnlineAt: now,

    },

  });



  await prisma.fingerSyncLog.create({

    data: {

      deviceId: device.id,

      direction: "PULL",

      status: inserted > 0 ? "SUCCESS" : "PARTIAL",

      operation: "device_pull_attendance",

      message: `${inserted} marcas nuevas, ${skipped} omitidas desde ${device.name}.`,

      triggeredById: params.userId,

      finishedAt: now,

      detailJson: { from: params.from.toISOString(), to: params.to.toISOString(), inserted, skipped },

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

