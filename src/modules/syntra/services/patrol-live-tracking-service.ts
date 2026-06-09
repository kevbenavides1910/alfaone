import { prisma } from "@/modules/core/db/prisma";
import { buildRoadPathsForTrail } from "@/lib/utils/gps-trail-road-snap";

const ONLINE_MAX_AGE_MS = 2 * 60 * 1000;
const STALE_MAX_AGE_MS = 10 * 60 * 1000;

/** Retencion maxima de puntos GPS por dispositivo (~2 meses). */
export const GPS_TRACK_RETENTION_MS = 62 * 24 * 60 * 60 * 1000;

/** Maximo de dias consultables en historial GPS (con filtro de device/ruta). */
export const GPS_HISTORY_MAX_QUERY_DAYS = 30;

/** Tope de puntos por recorrido en respuesta de historial. */
export const GPS_HISTORY_MAX_POINTS_PER_TRAIL = 5000;

export type DeviceLiveStatus = "online" | "stale" | "offline" | "no_signal";

export type DeviceLivePosition = {
  deviceId: string;
  imei: string;
  employeeCode: string;
  label: string | null;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  recordedAt: string | null;
  status: DeviceLiveStatus;
  source: "gps_track" | "nfc_mark" | null;
};

export type GpsTrackPoint = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export type DeviceGpsTrail = {
  deviceId: string;
  imei: string;
  label: string | null;
  employeeCode: string;
  points: GpsTrackPoint[];
  /** Trazos ajustados a calles (varios si hubo huecos de señal). */
  roadPaths?: { latitude: number; longitude: number }[][];
};

function resolveStatus(recordedAt: Date | null): DeviceLiveStatus {
  if (!recordedAt) return "no_signal";
  const age = Date.now() - recordedAt.getTime();
  if (age <= ONLINE_MAX_AGE_MS) return "online";
  if (age <= STALE_MAX_AGE_MS) return "stale";
  return "offline";
}

export function gpsRetentionCutoff(): Date {
  return new Date(Date.now() - GPS_TRACK_RETENTION_MS);
}

function parseQueryDate(raw: string | null | undefined, fallback: Date): Date {
  if (!raw?.trim()) return fallback;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function clampHistoryRange(desde: Date, hasta: Date): { desde: Date; hasta: Date } {
  const retentionMin = gpsRetentionCutoff();
  const now = new Date();
  let end = hasta > now ? now : hasta;
  let start = desde < retentionMin ? retentionMin : desde;
  if (start > end) start = end;

  const maxSpanMs = GPS_HISTORY_MAX_QUERY_DAYS * 24 * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxSpanMs) {
    start = new Date(end.getTime() - maxSpanMs);
  }

  return { desde: start, hasta: end };
}

function downsampleTrailPoints(points: GpsTrackPoint[], maxPoints: number): GpsTrackPoint[] {
  if (points.length <= maxPoints) return points;
  if (maxPoints < 2) return points.slice(-1);

  const sampled: GpsTrackPoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(points[Math.round(i * step)]);
  }
  return sampled;
}

function assetImei(attrs: unknown): string {
  if (!attrs || typeof attrs !== "object") return "";
  const imei = (attrs as Record<string, unknown>).imei;
  return imei == null ? "" : String(imei).trim();
}

export async function resolveDeviceIdsForRoute(routeId: string): Promise<string[]> {
  const phones = await prisma.patrolRoutePhone.findMany({
    where: { routeId },
    select: { assetId: true },
  });
  if (phones.length === 0) return [];

  const assets = await prisma.asset.findMany({
    where: { id: { in: phones.map((p) => p.assetId) } },
    select: { attributes: true },
  });
  const imeis = [...new Set(assets.map((a) => assetImei(a.attributes)).filter(Boolean))];
  if (imeis.length === 0) return [];

  const devices = await prisma.patrolDevice.findMany({
    where: { imei: { in: imeis } },
    select: { id: true },
  });
  return devices.map((d) => d.id);
}

export async function resolveDeviceIdsForFilters(input: {
  deviceId?: string | null;
  routeId?: string | null;
}): Promise<string[] | null> {
  const deviceId = input.deviceId?.trim() || null;
  const routeId = input.routeId?.trim() || null;

  if (deviceId && routeId) {
    const routeDeviceIds = await resolveDeviceIdsForRoute(routeId);
    return routeDeviceIds.includes(deviceId) ? [deviceId] : [];
  }
  if (deviceId) return [deviceId];
  if (routeId) return resolveDeviceIdsForRoute(routeId);
  return null;
}

async function latestGpsTrack(deviceId: string, imei: string) {
  return prisma.patrolGpsTrack.findFirst({
    where: {
      OR: [{ deviceId }, { imei }],
    },
    orderBy: { recordedAt: "desc" },
  });
}

async function latestMarkGps(imei: string) {
  return prisma.patrolMark.findFirst({
    where: {
      imei,
      latitude: { not: null },
      longitude: { not: null },
    },
    orderBy: { markedAt: "desc" },
  });
}

export async function getLiveDevicePositions(input?: {
  deviceId?: string | null;
  routeId?: string | null;
}): Promise<DeviceLivePosition[]> {
  const allowedIds = await resolveDeviceIdsForFilters(input ?? {});

  const devices = await prisma.patrolDevice.findMany({
    where: allowedIds ? { id: { in: allowedIds } } : undefined,
    orderBy: [{ isActive: "desc" }, { employeeCode: "asc" }],
  });

  const rows: DeviceLivePosition[] = [];

  for (const device of devices) {
    let latitude: number | null = null;
    let longitude: number | null = null;
    let recordedAt: Date | null = null;
    let source: DeviceLivePosition["source"] = null;

    const cachedLat = device.lastGpsLatitude;
    const cachedLng = device.lastGpsLongitude;
    const cachedAt = device.lastGpsAt;

    if (cachedLat != null && cachedLng != null && cachedAt) {
      latitude = Number(cachedLat);
      longitude = Number(cachedLng);
      recordedAt = cachedAt;
      source = "gps_track";
    } else {
      const track = await latestGpsTrack(device.id, device.imei);
      if (track) {
        latitude = Number(track.latitude);
        longitude = Number(track.longitude);
        recordedAt = track.recordedAt;
        source = "gps_track";
      } else {
        const mark = await latestMarkGps(device.imei);
        if (mark?.latitude != null && mark.longitude != null) {
          latitude = Number(mark.latitude);
          longitude = Number(mark.longitude);
          recordedAt = mark.markedAt;
          source = "nfc_mark";
        }
      }
    }

    rows.push({
      deviceId: device.id,
      imei: device.imei,
      employeeCode: device.employeeCode,
      label: device.label,
      isActive: device.isActive,
      latitude,
      longitude,
      recordedAt: recordedAt?.toISOString() ?? null,
      status: device.isActive ? resolveStatus(recordedAt) : "offline",
      source,
    });
  }

  return rows;
}

export async function getGpsTrackHistory(input: {
  deviceId?: string | null;
  routeId?: string | null;
  desde?: string | null;
  hasta?: string | null;
  snapRoads?: boolean;
}): Promise<{
  desde: string;
  hasta: string;
  retentionDays: number;
  maxQueryDays: number;
  requiresFilter: boolean;
  trails: DeviceGpsTrail[];
}> {
  const hasDeviceFilter = Boolean(input.deviceId?.trim());
  const hasRouteFilter = Boolean(input.routeId?.trim());
  if (!hasDeviceFilter && !hasRouteFilter) {
    const now = new Date();
    return {
      desde: now.toISOString(),
      hasta: now.toISOString(),
      retentionDays: 62,
      maxQueryDays: GPS_HISTORY_MAX_QUERY_DAYS,
      requiresFilter: true,
      trails: [],
    };
  }

  const deviceIds = await resolveDeviceIdsForFilters(input);
  const now = new Date();
  const defaultDesde = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { desde, hasta } = clampHistoryRange(
    parseQueryDate(input.desde, defaultDesde),
    parseQueryDate(input.hasta, now),
  );

  if (deviceIds && deviceIds.length === 0) {
    return {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      retentionDays: 62,
      maxQueryDays: GPS_HISTORY_MAX_QUERY_DAYS,
      requiresFilter: false,
      trails: [],
    };
  }

  const tracks = await prisma.patrolGpsTrack.findMany({
    where: {
      ...(deviceIds ? { deviceId: { in: deviceIds } } : {}),
      recordedAt: { gte: desde, lte: hasta },
    },
    orderBy: [{ deviceId: "asc" }, { recordedAt: "asc" }],
    select: {
      deviceId: true,
      imei: true,
      latitude: true,
      longitude: true,
      recordedAt: true,
    },
  });

  const devices = await prisma.patrolDevice.findMany({
    where: deviceIds ? { id: { in: deviceIds } } : undefined,
    select: { id: true, imei: true, label: true, employeeCode: true },
  });
  const deviceMap = new Map(devices.map((d) => [d.id, d]));

  const byDevice = new Map<string, GpsTrackPoint[]>();
  for (const t of tracks) {
    if (!t.deviceId) continue;
    const list = byDevice.get(t.deviceId) ?? [];
    list.push({
      latitude: Number(t.latitude),
      longitude: Number(t.longitude),
      recordedAt: t.recordedAt.toISOString(),
    });
    byDevice.set(t.deviceId, list);
  }

  const trails: DeviceGpsTrail[] = [];
  for (const [deviceId, points] of byDevice) {
    const dev = deviceMap.get(deviceId);
    trails.push({
      deviceId,
      imei: dev?.imei ?? tracks.find((x) => x.deviceId === deviceId)?.imei ?? "",
      label: dev?.label ?? null,
      employeeCode: dev?.employeeCode ?? "",
      points: downsampleTrailPoints(points, GPS_HISTORY_MAX_POINTS_PER_TRAIL),
    });
  }

  trails.sort((a, b) =>
    (a.label ?? a.employeeCode).localeCompare(b.label ?? b.employeeCode, "es"),
  );

  if (input.snapRoads) {
    await Promise.all(
      trails.map(async (trail) => {
        try {
          trail.roadPaths = await buildRoadPathsForTrail(trail.points);
        } catch {
          trail.roadPaths = undefined;
        }
      }),
    );
  }

  return {
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    retentionDays: 62,
    maxQueryDays: GPS_HISTORY_MAX_QUERY_DAYS,
    requiresFilter: false,
    trails,
  };
}

export async function pruneAllGpsTracks(): Promise<number> {
  const cutoff = gpsRetentionCutoff();
  const result = await prisma.patrolGpsTrack.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  });
  return result.count;
}

export async function pruneDeviceGpsTracks(deviceId: string): Promise<void> {
  const cutoff = gpsRetentionCutoff();
  await prisma.patrolGpsTrack.deleteMany({
    where: { deviceId, recordedAt: { lt: cutoff } },
  });
}

export async function updateDeviceLastGps(
  deviceId: string,
  latitude: number,
  longitude: number,
  recordedAt: Date,
) {
  try {
    await prisma.patrolDevice.update({
      where: { id: deviceId },
      data: {
        lastGpsLatitude: latitude,
        lastGpsLongitude: longitude,
        lastGpsAt: recordedAt,
      },
    });
  } catch {
    // Columnas opcionales si la migracion aun no corre
  }
}
