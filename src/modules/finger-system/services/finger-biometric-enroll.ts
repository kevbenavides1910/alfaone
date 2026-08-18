import { prisma } from "@/modules/core/db/prisma";
import { createZKTecoAdapter } from "@/modules/finger-system/integrations/biometric/zkteco-adapter";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";
import { fingerLabel } from "@/modules/finger-system/config/finger-biometrics.client";

export type FingerprintEnrollResult = {
  ok: boolean;
  message: string;
  fingerId: number;
  fingerLabel: string;
  deviceId: string;
  deviceName: string;
  attUserId: number;
  badgeNumber: string;
};

/** Inicia enrolamiento de huella en el dispositivo ZK seleccionado. */
export async function startFingerprintEnrollment(params: {
  deviceId: string;
  attUserId: number;
  badgeNumber: string;
  fingerId: number;
  userId: string;
  ipAddress?: string | null;
}): Promise<FingerprintEnrollResult> {
  if (params.fingerId < 0 || params.fingerId > 9) {
    throw new Error("Índice de dedo inválido (0–9).");
  }

  const device = await prisma.fingerDevice.findUnique({ where: { id: params.deviceId } });
  if (!device) throw new Error("Dispositivo biométrico no encontrado.");

  const adapter = createZKTecoAdapter({
    ipAddress: device.ipAddress,
    port: device.port,
  });

  const sync = await adapter.sync();
  if (!sync.ok) {
    throw new Error(`Dispositivo sin conexión: ${sync.message}`);
  }

  const enroll = await adapter.startFingerprintEnrollment({
    userPin: params.badgeNumber,
    fingerId: params.fingerId,
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.biometric.enroll.start",
    entityType: "FingerDevice",
    entityId: device.id,
    ipAddress: params.ipAddress ?? null,
    metadata: {
      attUserId: params.attUserId,
      badgeNumber: params.badgeNumber,
      fingerId: params.fingerId,
      enrollOk: enroll.ok,
    },
    message: enroll.message,
    result: enroll.ok ? "success" : "failed",
  });

  await prisma.fingerSyncLog.create({
    data: {
      deviceId: device.id,
      direction: "PUSH",
      status: enroll.ok ? "SUCCESS" : "FAILED",
      operation: "fingerprint_enroll_start",
      message: enroll.message,
      triggeredById: params.userId,
      finishedAt: new Date(),
      detailJson: {
        attUserId: params.attUserId,
        badgeNumber: params.badgeNumber,
        fingerId: params.fingerId,
        fingerLabel: fingerLabel(params.fingerId),
      },
    },
  });

  return {
    ok: enroll.ok,
    message: enroll.message,
    fingerId: params.fingerId,
    fingerLabel: fingerLabel(params.fingerId),
    deviceId: device.id,
    deviceName: device.name,
    attUserId: params.attUserId,
    badgeNumber: params.badgeNumber,
  };
}
