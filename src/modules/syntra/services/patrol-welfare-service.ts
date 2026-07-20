import { prisma } from "@/modules/core/db/prisma";
import { getTodayScheduleWindows } from "@/modules/syntra/services/patrol-route-schedule-service";
import { getAuthorizedRoutesForDevice } from "@/modules/syntra/services/patrol-routes-service";
import { assetImeiFromAttributes } from "@/modules/syntra/services/patrol-inventory-phone-service";
import { patrolImeisMatch, patrolMarkWithinScheduleWindow } from "@/modules/syntra/utils/costa-rica-time";

const WELFARE_ACK_GRACE_MINUTES = 10;

export type WelfareConfigRow = {
  COD_RUTA: string;
  DES_RUTA: string;
  HABILITADO: "S" | "N";
  INTERVALO_MIN: number;
  HOR_INI: string;
  HOR_FIN: string;
};

export type WelfarePendingRow = {
  ID: string;
  COD_RUTA: string;
  DES_RUTA: string;
};

function clampInterval(minutes: number): number {
  return Math.min(480, Math.max(5, Math.round(minutes)));
}

export async function updateRouteWelfareConfig(
  routeId: string,
  welfareEnabled: boolean,
  welfareIntervalMinutes: number,
) {
  return prisma.patrolRoute.update({
    where: { id: routeId },
    data: {
      welfareEnabled,
      welfareIntervalMinutes: clampInterval(welfareIntervalMinutes),
    },
    select: {
      id: true,
      welfareEnabled: true,
      welfareIntervalMinutes: true,
    },
  });
}

async function routeImeis(routeId: string): Promise<string[]> {
  const routePhones = await prisma.patrolRoutePhone.findMany({
    where: { routeId },
    select: { assetId: true },
  });
  if (routePhones.length === 0) return [];

  const assets = await prisma.asset.findMany({
    where: { id: { in: [...new Set(routePhones.map((r) => r.assetId))] } },
    select: { id: true, attributes: true },
  });
  const imeiByAsset = new Map(
    assets.map((a) => [a.id, assetImeiFromAttributes(a.attributes).trim()]),
  );

  const imeis: string[] = [];
  for (const rp of routePhones) {
    const imei = imeiByAsset.get(rp.assetId) ?? "";
    if (!imei) continue;
    if (!imeis.some((existing) => patrolImeisMatch(existing, imei))) {
      imeis.push(imei);
    }
  }
  return imeis;
}

export async function triggerManualWelfareCheck(routeId: string) {
  const route = await prisma.patrolRoute.findUnique({
    where: { id: routeId },
    select: { id: true, code: true, name: true, isActive: true },
  });
  if (!route) throw new Error("ROUTE_NOT_FOUND");
  if (!route.isActive) throw new Error("ROUTE_INACTIVE");

  const imeis = await routeImeis(routeId);
  if (imeis.length === 0) throw new Error("NO_PHONES");

  const devices = await prisma.patrolDevice.findMany({
    where: { imei: { in: imeis } },
    select: { id: true, imei: true },
  });
  const deviceByImei = new Map(devices.map((d) => [d.imei, d.id]));

  const now = new Date();
  const created = await prisma.$transaction(
    imeis.map((imei) =>
      prisma.patrolWelfareCheck.create({
        data: {
          routeId,
          imei,
          deviceId: deviceByImei.get(imei) ?? null,
          source: "MANUAL",
          status: "PENDING",
          scheduledAt: now,
        },
        select: { id: true, imei: true },
      }),
    ),
  );

  return { route, createdCount: created.length, checks: created };
}

export async function getPendingWelfareChecksForDevice(
  deviceId: string,
  imei: string,
): Promise<WelfarePendingRow[]> {
  const checks = await prisma.patrolWelfareCheck.findMany({
    where: {
      status: "PENDING",
      OR: [{ deviceId }, { imei }],
    },
    include: { route: { select: { code: true, name: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });

  return checks
    .filter((c) => patrolImeisMatch(c.imei, imei))
    .map((c) => ({
      ID: c.id,
      COD_RUTA: c.route.code,
      DES_RUTA: c.route.name,
    }));
}

type WelfareRouteInput = {
  code: string;
  name: string;
  welfareEnabled?: boolean;
  welfareIntervalMinutes?: number;
  openSchedule?: boolean;
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
};

function mergeScheduleWindows(
  windows: Array<{ startTime: string; endTime: string }>,
): { startTime: string; endTime: string } | null {
  if (windows.length === 0) return null;
  let startTime = windows[0].startTime;
  let endTime = windows[0].endTime;
  for (const window of windows.slice(1)) {
    if (window.startTime < startTime) startTime = window.startTime;
    if (window.endTime > endTime) endTime = window.endTime;
  }
  return { startTime, endTime };
}

/** Una sola configuración de hombre vivo por ruta (no por punto ni por ronda horaria). */
export function buildWelfareConfigForRoutes(routes: WelfareRouteInput[]): WelfareConfigRow[] {
  const rows: WelfareConfigRow[] = [];
  for (const route of routes) {
    if (!(route.welfareEnabled ?? false)) continue;
    let windows = getTodayScheduleWindows({
      openSchedule: route.openSchedule ?? false,
      schedules: route.schedules,
    });
    if (windows.length === 0) {
      windows = [{ startTime: "00:00", endTime: "23:59" }];
    }
    const merged = mergeScheduleWindows(windows);
    if (!merged) continue;
    rows.push({
      COD_RUTA: route.code,
      DES_RUTA: route.name,
      HABILITADO: "S",
      INTERVALO_MIN: clampInterval(route.welfareIntervalMinutes ?? 60),
      HOR_INI: merged.startTime,
      HOR_FIN: merged.endTime,
    });
  }
  return rows;
}

function isRouteActiveNow(route: {
  openSchedule: boolean;
  schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
}): boolean {
  const windows = getTodayScheduleWindows(route);
  if (windows.length === 0) return false;
  const now = new Date();
  return windows.some((w) => patrolMarkWithinScheduleWindow(now, w.startTime, w.endTime));
}

/** Marca alertas pendientes vencidas como no respondidas. */
export async function markOverdueWelfareChecksAsMissed(
  graceMinutes = WELFARE_ACK_GRACE_MINUTES,
): Promise<number> {
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);
  const result = await prisma.patrolWelfareCheck.updateMany({
    where: {
      status: "PENDING",
      scheduledAt: { lt: cutoff },
    },
    data: { status: "MISSED" },
  });
  return result.count;
}

/** Crea alertas programadas según intervalo configurado por ruta. */
export async function runScheduledWelfareChecks(): Promise<{ created: number }> {
  const routes = await prisma.patrolRoute.findMany({
    where: { isActive: true, welfareEnabled: true },
    include: { schedules: true },
  });

  const now = new Date();
  let created = 0;

  for (const route of routes) {
    if (!isRouteActiveNow(route)) continue;

    const imeis = await routeImeis(route.id);
    if (imeis.length === 0) continue;

    const intervalMs = clampInterval(route.welfareIntervalMinutes) * 60 * 1000;
    const devices = await prisma.patrolDevice.findMany({
      where: { imei: { in: imeis } },
      select: { id: true, imei: true },
    });
    const deviceByImei = new Map(devices.map((d) => [d.imei, d.id]));

    for (const imei of imeis) {
      const pending = await prisma.patrolWelfareCheck.findFirst({
        where: { routeId: route.id, imei, status: "PENDING" },
      });
      if (pending) continue;

      const last = await prisma.patrolWelfareCheck.findFirst({
        where: { routeId: route.id, imei },
        orderBy: { scheduledAt: "desc" },
      });
      if (last && now.getTime() - last.scheduledAt.getTime() < intervalMs) continue;

      await prisma.patrolWelfareCheck.create({
        data: {
          routeId: route.id,
          imei,
          deviceId: deviceByImei.get(imei) ?? null,
          source: "SCHEDULED",
          status: "PENDING",
          scheduledAt: now,
          triggeredAt: now,
        },
      });
      created++;
    }
  }

  return { created };
}

/** Job periódico: vence pendientes y genera alertas programadas. */
export async function runPatrolWelfareCron() {
  const missed = await markOverdueWelfareChecksAsMissed();
  const { created } = await runScheduledWelfareChecks();
  return { missed, created };
}

export async function getWelfareConfigForDevice(deviceId: string): Promise<WelfareConfigRow[]> {
  const routes = await getAuthorizedRoutesForDevice(deviceId);
  return buildWelfareConfigForRoutes(
    routes.map((r) => ({
      code: r.code,
      name: r.name,
      welfareEnabled: r.welfareEnabled,
      welfareIntervalMinutes: r.welfareIntervalMinutes,
      openSchedule: r.openSchedule,
      schedules: r.schedules,
    })),
  );
}

export async function acknowledgeWelfareCheck(input: {
  checkId?: string;
  deviceId: string;
  imei: string;
  routeCode?: string;
  source?: string;
  scheduledAt?: string;
  latitude?: number;
  longitude?: number;
}) {
  const now = new Date();

  if (input.checkId) {
    const existing = await prisma.patrolWelfareCheck.findUnique({
      where: { id: input.checkId },
    });
    if (!existing) throw new Error("CHECK_NOT_FOUND");
    if (!patrolImeisMatch(existing.imei, input.imei)) throw new Error("IMEI_MISMATCH");
    if (existing.status === "ACK") return existing;

    return prisma.patrolWelfareCheck.update({
      where: { id: input.checkId },
      data: {
        status: "ACK",
        acknowledgedAt: now,
        triggeredAt: existing.triggeredAt ?? now,
        ackLatitude: input.latitude ?? null,
        ackLongitude: input.longitude ?? null,
      },
    });
  }

  if (!input.routeCode) throw new Error("ROUTE_REQUIRED");

  const route = await prisma.patrolRoute.findFirst({
    where: { code: input.routeCode.trim().toUpperCase() },
    select: { id: true },
  });
  if (!route) throw new Error("ROUTE_NOT_FOUND");

  return prisma.patrolWelfareCheck.create({
    data: {
      routeId: route.id,
      deviceId: input.deviceId,
      imei: input.imei,
      source: input.source ?? "SCHEDULED",
      status: "ACK",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : now,
      triggeredAt: now,
      acknowledgedAt: now,
      ackLatitude: input.latitude ?? null,
      ackLongitude: input.longitude ?? null,
    },
  });
}

function costaRicaDayBounds(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextIso = next.toISOString().slice(0, 10);
  return {
    start: new Date(`${isoDate}T06:00:00.000Z`),
    end: new Date(`${nextIso}T05:59:59.999Z`),
  };
}

function parseIsoDateRange(desde: string, hasta: string) {
  if (desde > hasta) {
    throw new Error("La fecha inicial no puede ser mayor que la final");
  }
  const first = costaRicaDayBounds(desde);
  const last = costaRicaDayBounds(hasta);
  return { start: first.start, end: last.end };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  ACK: "Confirmado",
  MISSED: "No respondido",
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SCHEDULED: "Programado",
};

export async function getWelfareHistoryReport(input: {
  desde: string;
  hasta: string;
  imei?: string;
  routeId?: string;
  status?: string;
}) {
  const { start, end } = parseIsoDateRange(input.desde, input.hasta);

  const checks = await prisma.patrolWelfareCheck.findMany({
    where: {
      scheduledAt: { gte: start, lte: end },
      ...(input.imei ? { imei: { contains: input.imei.trim() } } : {}),
      ...(input.routeId ? { routeId: input.routeId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    include: {
      route: { select: { code: true, name: true } },
    },
    orderBy: [{ scheduledAt: "desc" }],
    take: 2000,
  });

  const devices = await prisma.patrolDevice.findMany({
    where: { imei: { in: [...new Set(checks.map((c) => c.imei))] } },
    select: { imei: true, employeeCode: true },
  });
  const employeeByImei = new Map(devices.map((d) => [d.imei, d.employeeCode]));

  const filas = checks.map((c) => ({
    id: c.id,
    scheduledAt: c.scheduledAt.toISOString(),
    acknowledgedAt: c.acknowledgedAt?.toISOString() ?? null,
    imei: c.imei,
    employeeCode: employeeByImei.get(c.imei) ?? null,
    routeCode: c.route.code,
    routeName: c.route.name,
    source: c.source,
    sourceLabel: SOURCE_LABELS[c.source] ?? c.source,
    status: c.status,
    statusLabel: STATUS_LABELS[c.status] ?? c.status,
    ackLatitude: c.ackLatitude?.toString() ?? null,
    ackLongitude: c.ackLongitude?.toString() ?? null,
  }));

  const totales = {
    total: filas.length,
    confirmados: filas.filter((f) => f.status === "ACK").length,
    pendientes: filas.filter((f) => f.status === "PENDING").length,
    noRespondidos: filas.filter((f) => f.status === "MISSED").length,
    manuales: filas.filter((f) => f.source === "MANUAL").length,
    programados: filas.filter((f) => f.source === "SCHEDULED").length,
  };

  return {
    periodo: { desde: input.desde, hasta: input.hasta },
    totales,
    filas,
  };
}
