import { prisma } from "@/modules/core/db/prisma";
import { ensureFingerSettingsRow } from "@/modules/finger-system/services/finger-settings";
import { probeAllFingerDevices } from "@/modules/finger-system/services/finger-devices";
import { applyAtt2016PunchImport } from "@/modules/finger-system/services/att2016-punches-import";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

export type FingerAutoSyncResult = {
  skipped?: boolean;
  reason?: string;
  ok?: boolean;
  steps?: Record<string, unknown>;
};

const LOCK_MAX_MS = 30 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function runFingerAutoSync(params: {
  userId?: string | null;
  trigger: "cron" | "manual";
  ipAddress?: string | null;
}): Promise<FingerAutoSyncResult> {
  const settings = await ensureFingerSettingsRow();

  if (params.trigger === "cron" && !settings.syncAutoEnabled) {
    return { skipped: true, reason: "sync_auto_disabled" };
  }

  if (params.trigger === "cron" && settings.lastAutoSyncAt) {
    const elapsed = Date.now() - settings.lastAutoSyncAt.getTime();
    const intervalMs = settings.syncIntervalMinutes * 60 * 1000;
    if (elapsed < intervalMs) {
      return { skipped: true, reason: "interval_not_elapsed" };
    }
  }

  if (settings.syncRunningAt) {
    const runningFor = Date.now() - settings.syncRunningAt.getTime();
    if (runningFor < LOCK_MAX_MS) {
      return { skipped: true, reason: "already_running" };
    }
  }

  const syncLog = await prisma.fingerSyncLog.create({
    data: {
      direction: "PULL",
      status: "RUNNING",
      operation: params.trigger === "cron" ? "auto_sync" : "manual_sync",
      message: "Sincronización Finger System en curso…",
      triggeredById: params.userId ?? null,
    },
  });

  await prisma.appFingerSettings.update({
    where: { id: "default" },
    data: { syncRunningAt: new Date() },
  });

  const steps: Record<string, unknown> = {};

  try {
    const probe = await probeAllFingerDevices();
    steps.devices = { total: probe.total, online: probe.online };

    const to = new Date();
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - 3);

    steps.punches = await applyAtt2016PunchImport({
      userId: params.userId ?? null,
      from,
      to,
      ipAddress: params.ipAddress ?? null,
    });

    await prisma.fingerSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        message: `Sync OK: ${probe.online}/${probe.total} dispositivos en línea.`,
        finishedAt: new Date(),
        detailJson: steps,
      },
    });

    await prisma.appFingerSettings.update({
      where: { id: "default" },
      data: { lastAutoSyncAt: new Date(), syncRunningAt: null },
    });

    if (params.userId) {
      await logFingerOperation({
        userId: params.userId,
        action: "finger.sync.auto",
        entityType: "FingerSyncLog",
        entityId: syncLog.id,
        ipAddress: params.ipAddress ?? null,
        metadata: steps,
      });
    }

    return { ok: true, steps };
  } catch (e) {
    await prisma.fingerSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        message: e instanceof Error ? e.message : "Error en sincronización automática.",
        finishedAt: new Date(),
      },
    });
    await prisma.appFingerSettings.update({
      where: { id: "default" },
      data: { syncRunningAt: null },
    });
    throw e;
  }
}
