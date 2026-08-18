import { prisma } from "@/modules/core/db/prisma";
import { createZKTecoAdapter } from "@/modules/finger-system/integrations/biometric/zkteco-adapter";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

export type FingerDeviceConnectResult = {
  deviceId: string;
  status: "ONLINE" | "OFFLINE";
  message: string;
  employeeCount: number;
  fingerprintCount: number;
  punchCount: number;
  latencyMs: number | null;
  productName: string | null;
};

/** Conecta al reloj vía TCP/ZK y actualiza contadores (estilo Attendance Management). */
export async function connectFingerDevice(params: {
  deviceId: string;
  userId: string;
  ipAddress?: string | null;
}): Promise<FingerDeviceConnectResult> {
  const device = await prisma.fingerDevice.findUnique({ where: { id: params.deviceId } });
  if (!device) throw new Error("Dispositivo no encontrado.");

  const adapter = createZKTecoAdapter({
    ipAddress: device.ipAddress,
    port: device.port,
  });

  let status: "ONLINE" | "OFFLINE" = "OFFLINE";
  let message = "Sin respuesta";
  let latencyMs: number | null = null;
  let employeeCount = device.employeeCount;
  let fingerprintCount = device.fingerprintCount;
  let punchCount = device.punchCount;

  try {
    const sync = await adapter.sync();
    const info = await adapter.getDeviceInfo();
    latencyMs = typeof info.latencyMs === "number" ? info.latencyMs : null;

    if (sync.ok) {
      status = "ONLINE";
      message = sync.message;
      try {
        const users = await adapter.getUsers();
        employeeCount = users.length;
        fingerprintCount = users.length;
      } catch {
        /* protocolo parcial */
      }
      try {
        const from = new Date();
        from.setFullYear(from.getFullYear() - 1);
        const logs = await adapter.getAttendance(from, new Date());
        punchCount = logs.length;
      } catch {
        punchCount = await prisma.fingerPunch.count({
          where: device.serialNumber ? { deviceSn: device.serialNumber } : { id: "never" },
        });
      }
    } else {
      message = sync.message;
    }
  } catch (e) {
    message = e instanceof Error ? e.message : "Error de conexión";
  }

  const now = new Date();
  await prisma.fingerDevice.update({
    where: { id: device.id },
    data: {
      status,
      lastOnlineAt: status === "ONLINE" ? now : device.lastOnlineAt,
      lastSyncAt: now,
      employeeCount,
      fingerprintCount,
      punchCount,
    },
  });

  await prisma.fingerSyncLog.create({
    data: {
      deviceId: device.id,
      direction: "PULL",
      status: status === "ONLINE" ? "SUCCESS" : "FAILED",
      operation: "device_connect",
      message,
      triggeredById: params.userId,
      finishedAt: now,
      detailJson: { employeeCount, fingerprintCount, punchCount, latencyMs },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.device.connect",
    entityType: "FingerDevice",
    entityId: device.id,
    ipAddress: params.ipAddress ?? null,
    metadata: { status, employeeCount, punchCount },
  });

  return {
    deviceId: device.id,
    status,
    message,
    employeeCount,
    fingerprintCount,
    punchCount,
    latencyMs,
    productName: device.model,
  };
}
