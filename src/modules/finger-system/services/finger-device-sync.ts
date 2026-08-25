import { prisma } from "@/modules/core/db/prisma";
import { probeAllFingerDevices } from "@/modules/finger-system/services/finger-devices";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

/** Sincronización manual Fase 4: verifica conectividad de todos los dispositivos activos. */
export async function runFingerDeviceStatusSync(params: {
  userId: string;
  ipAddress?: string | null;
}) {
  const syncLog = await prisma.fingerSyncLog.create({
    data: {
      direction: "PULL",
      status: "RUNNING",
      operation: "device_status_probe",
      message: "Verificando dispositivos biométricos…",
      triggeredById: params.userId,
    },
  });

  try {
    const result = await probeAllFingerDevices();

    await prisma.fingerSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        message: `${result.online}/${result.total} dispositivos en línea.`,
        finishedAt: new Date(),
        detailJson: {
          total: result.total,
          online: result.online,
        },
      },
    });

    await logFingerOperation({
      userId: params.userId,
      action: "finger.sync.device_status",
      entityType: "FingerSyncLog",
      entityId: syncLog.id,
      ipAddress: params.ipAddress ?? null,
      metadata: { total: result.total, online: result.online },
    });

    return { syncLogId: syncLog.id, ...result };
  } catch (e) {
    await prisma.fingerSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        message: e instanceof Error ? e.message : "Error en verificación de dispositivos.",
        finishedAt: new Date(),
      },
    });
    throw e;
  }
}
