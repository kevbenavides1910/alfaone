import { randomUUID } from "crypto";
import { prisma } from "@/modules/core/db/prisma";
import { createZKTecoAdapter } from "@/modules/finger-system/integrations/biometric/zkteco-adapter";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

export type PushDeviceResult = {
  deviceId: string;
  deviceName: string;
  ok: boolean;
  message: string;
  templatesCopied?: number;
};

async function resolveTargetDevices(employeeId: string, deviceIds?: string[]) {
  if (deviceIds?.length) {
    return prisma.fingerDevice.findMany({
      where: { id: { in: deviceIds }, isActive: true },
    });
  }
  const assigned = await prisma.fingerEmployeeDevice.findMany({
    where: { employeeId },
    select: { deviceId: true },
  });
  if (assigned.length) {
    return prisma.fingerDevice.findMany({
      where: { id: { in: assigned.map((a) => a.deviceId) }, isActive: true },
    });
  }
  return prisma.fingerDevice.findMany({ where: { isActive: true } });
}

/**
 * Envía un empleado (link biométrico) a uno o más relojes ZK.
 * Si otro reloj ya tiene plantillas, intenta copiarlas (paridad Odoo).
 */
export async function pushEmployeeToDevices(params: {
  employeeId: string;
  userId: string;
  deviceIds?: string[];
  ipAddress?: string | null;
}): Promise<{ results: PushDeviceResult[]; okCount: number }> {
  const link = await prisma.fingerEmployeeLink.findUnique({
    where: { employeeId: params.employeeId },
    include: { employee: { select: { nombre: true, codigoEmpleado: true } } },
  });
  if (!link) throw new Error("El empleado no tiene vínculo biométrico (badge/USERID).");
  const badge = (link.badgeNumber || String(link.attUserId || "")).trim();
  if (!badge) throw new Error("Falta badge / USERID para enviar al reloj.");

  const devices = await resolveTargetDevices(params.employeeId, params.deviceIds);
  if (!devices.length) throw new Error("No hay dispositivos activos destino.");

  const name = (link.employee.nombre || link.employee.codigoEmpleado || badge).slice(0, 24);
  const results: PushDeviceResult[] = [];

  // Buscar plantillas en algún reloj online
  let sourceTemplates: Awaited<ReturnType<ReturnType<typeof createZKTecoAdapter>["getUserTemplates"]>> = [];
  for (const device of devices) {
    try {
      const adapter = createZKTecoAdapter({ ipAddress: device.ipAddress, port: device.port });
      const templates = await adapter.getUserTemplates(badge);
      if (templates.length) {
        sourceTemplates = templates;
        break;
      }
    } catch {
      // continuar
    }
  }

  for (const device of devices) {
    const adapter = createZKTecoAdapter({ ipAddress: device.ipAddress, port: device.port });
    try {
      const set = await adapter.setUser({
        userId: badge,
        name,
        privilege: link.privilege ?? 0,
        password: link.pin ?? "",
        card: link.card ? Number.parseInt(link.card, 10) || 0 : 0,
      });
      if (!set.ok) {
        results.push({
          deviceId: device.id,
          deviceName: device.name,
          ok: false,
          message: set.message,
        });
        continue;
      }

      let templatesCopied = 0;
      if (sourceTemplates.length) {
        const save = await adapter.saveUserTemplates(badge, sourceTemplates);
        if (save.ok) templatesCopied = sourceTemplates.length;
      }

      await prisma.fingerDevice.update({
        where: { id: device.id },
        data: { lastSyncAt: new Date(), status: "ONLINE", lastOnlineAt: new Date() },
      });

      results.push({
        deviceId: device.id,
        deviceName: device.name,
        ok: true,
        message: set.message,
        templatesCopied,
      });
    } catch (e) {
      results.push({
        deviceId: device.id,
        deviceName: device.name,
        ok: false,
        message: e instanceof Error ? e.message : "Error al enviar usuario",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const errMsg = results
    .filter((r) => !r.ok)
    .map((r) => `${r.deviceName}: ${r.message}`)
    .join("; ");

  await prisma.fingerEmployeeLink.update({
    where: { id: link.id },
    data: {
      lastPushAt: new Date(),
      lastPushError: okCount === results.length ? null : errMsg || null,
      lastSyncAt: new Date(),
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.biometric.push_devices",
    entityType: "Employee",
    entityId: params.employeeId,
    ipAddress: params.ipAddress ?? null,
    metadata: { badge, okCount, total: results.length },
    message: `Push a ${okCount}/${results.length} reloj(es)`,
    result: okCount > 0 ? "success" : "failed",
  });

  return { results, okCount };
}

export async function setEmployeeDeviceAssignments(params: {
  employeeId: string;
  deviceIds: string[];
}) {
  await prisma.fingerEmployeeDevice.deleteMany({ where: { employeeId: params.employeeId } });
  if (params.deviceIds.length) {
    await prisma.fingerEmployeeDevice.createMany({
      data: params.deviceIds.map((deviceId) => ({
        id: randomUUID(),
        employeeId: params.employeeId,
        deviceId,
      })),
      skipDuplicates: true,
    });
  }
  return prisma.fingerEmployeeDevice.findMany({
    where: { employeeId: params.employeeId },
    include: { device: { select: { id: true, name: true, ipAddress: true } } },
  });
}

export async function listEmployeeDeviceAssignments(employeeId: string) {
  return prisma.fingerEmployeeDevice.findMany({
    where: { employeeId },
    include: { device: { select: { id: true, name: true, ipAddress: true, status: true } } },
  });
}
