import { prisma } from "@/modules/core/db/prisma";
import { createZKTecoAdapter } from "@/modules/finger-system/integrations/biometric/zkteco-adapter";
import { fingerLabel } from "@/modules/finger-system/config/finger-biometrics.client";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";
import { pushEmployeeToDevices } from "@/modules/finger-system/services/finger-device-push";

export type EnrollFingerprintResult = {
  ok: boolean;
  message: string;
  fingerId: number;
  fingerLabel: string;
  deviceId: string;
  deviceName: string;
  attUserId: number | null;
  badgeNumber: string;
  push?: { okCount: number; total: number };
  templatesDistributed?: number;
};

/**
 * Flujo Odoo: set_user en reloj origen → STARTENROLL → (opcional) copiar plantillas a otros relojes.
 */
export async function enrollFingerprintOnDevice(params: {
  employeeId: string;
  deviceId: string;
  fingerId: number;
  userId: string;
  distributeToOtherDevices?: boolean;
  ipAddress?: string | null;
}): Promise<EnrollFingerprintResult> {
  if (params.fingerId < 0 || params.fingerId > 9) {
    throw new Error("Índice de dedo inválido (0–9).");
  }

  const link = await prisma.fingerEmployeeLink.findUnique({
    where: { employeeId: params.employeeId },
    include: { employee: { select: { nombre: true, codigoEmpleado: true } } },
  });
  if (!link) throw new Error("El empleado no tiene vínculo biométrico.");

  const badge = (link.badgeNumber || String(link.attUserId || "")).trim();
  if (!badge) throw new Error("Falta badge / USERID para enrolar.");

  const device = await prisma.fingerDevice.findUnique({ where: { id: params.deviceId } });
  if (!device) throw new Error("Dispositivo biométrico no encontrado.");

  const adapter = createZKTecoAdapter({
    ipAddress: device.ipAddress,
    port: device.port,
  });

  const sync = await adapter.sync();
  if (!sync.ok) throw new Error(`Dispositivo sin conexión: ${sync.message}`);

  const name = (link.employee.nombre || link.employee.codigoEmpleado || badge).slice(0, 24);
  const set = await adapter.setUser({
    userId: badge,
    name,
    privilege: link.privilege ?? 0,
    password: link.pin ?? "",
    card: link.card ? Number.parseInt(link.card, 10) || 0 : 0,
  });
  if (!set.ok) throw new Error(set.message);

  const enroll = await adapter.startFingerprintEnrollment({
    userPin: badge,
    fingerId: params.fingerId,
  });

  let templatesDistributed = 0;
  let pushSummary: { okCount: number; total: number } | undefined;

  if (enroll.ok && params.distributeToOtherDevices !== false) {
    // Esperar un poco a que el reloj capture; luego intentar leer y distribuir.
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const templates = await adapter.getUserTemplates(badge);
      if (templates.length) {
        await prisma.fingerEmployeeLink.update({
          where: { id: link.id },
          data: { fingerprintCount: templates.length, lastSyncAt: new Date() },
        });
        const others = await prisma.fingerDevice.findMany({
          where: { isActive: true, id: { not: device.id } },
        });
        for (const other of others) {
          try {
            const otherAdapter = createZKTecoAdapter({
              ipAddress: other.ipAddress,
              port: other.port,
            });
            await otherAdapter.setUser({
              userId: badge,
              name,
              privilege: link.privilege ?? 0,
              password: link.pin ?? "",
            });
            const save = await otherAdapter.saveUserTemplates(badge, templates);
            if (save.ok) templatesDistributed += 1;
          } catch {
            // continuar con otros relojes
          }
        }
      }
    } catch {
      // enroll inició aunque no se pudieron leer plantillas aún
    }

    try {
      const push = await pushEmployeeToDevices({
        employeeId: params.employeeId,
        userId: params.userId,
        deviceIds: undefined,
        ipAddress: params.ipAddress,
      });
      pushSummary = { okCount: push.okCount, total: push.results.length };
    } catch {
      // push opcional tras enroll
    }
  }

  await logFingerOperation({
    userId: params.userId,
    action: "finger.biometric.enroll",
    entityType: "FingerDevice",
    entityId: device.id,
    ipAddress: params.ipAddress ?? null,
    metadata: {
      employeeId: params.employeeId,
      badge,
      fingerId: params.fingerId,
      enrollOk: enroll.ok,
      templatesDistributed,
    },
    message: enroll.message,
    result: enroll.ok ? "success" : "failed",
  });

  await prisma.fingerSyncLog.create({
    data: {
      deviceId: device.id,
      direction: "PUSH",
      status: enroll.ok ? "SUCCESS" : "FAILED",
      operation: "fingerprint_enroll",
      message: enroll.message,
      triggeredById: params.userId,
      finishedAt: new Date(),
      detailJson: {
        badge,
        fingerId: params.fingerId,
        fingerLabel: fingerLabel(params.fingerId),
        templatesDistributed,
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
    attUserId: link.attUserId,
    badgeNumber: badge,
    push: pushSummary,
    templatesDistributed,
  };
}
