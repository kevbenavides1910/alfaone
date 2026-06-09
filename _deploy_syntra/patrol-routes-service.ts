import { prisma } from "@/modules/core/db/prisma";
import { legacyDateTodayCostaRica } from "@/modules/syntra/utils/costa-rica-time";
import { resolveDevicePositionLabel } from "@/modules/syntra/services/patrol-inventory-phone-service";
import { resolveDeviceAssetId } from "@/modules/syntra/services/patrol-route-phone-service";
import { getTodayScheduleWindows } from "@/modules/syntra/services/patrol-route-schedule-service";

type LegacyRouteRow = {
  COD_RUTA: string;
  DES_RUTA: string;
  COD_PUNTO: string;
  DES_PUNTO: string;
  TAG: string;
  HOR_INI: string;
  HOR_FIN: string;
  FEC_ASIG: string;
  LAT: string;
  LON: string;
  ORDEN: string;
};

function decToStr(v: { toString(): string } | null | undefined): string {
  if (v == null) return "";
  return v.toString();
}

async function getAuthorizedRoutesForDevice(deviceId: string) {
  const device = await prisma.patrolDevice.findUnique({ where: { id: deviceId } });
  if (!device) return [];

  const assetId = await resolveDeviceAssetId(device);
  if (!assetId) return [];

  const routePhones = await prisma.patrolRoutePhone.findMany({
    where: {
      assetId,
      route: { isActive: true },
    },
    include: {
      route: {
        include: {
          points: { orderBy: [{ sortOrder: "asc" }, { code: "asc" }] },
          schedules: { orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }] },
        },
      },
    },
    orderBy: [{ route: { code: "asc" } }],
  });

  const seen = new Set<string>();
  const routes = [];
  for (const row of routePhones) {
    if (seen.has(row.route.id)) continue;
    seen.add(row.route.id);
    routes.push(row.route);
  }
  return routes;
}

export async function getPatrolRoutesForDevice(deviceId: string) {
  const device = await prisma.patrolDevice.findUnique({ where: { id: deviceId } });
  const fecAsig = legacyDateTodayCostaRica();
  const authorizedRoutes = await getAuthorizedRoutesForDevice(deviceId);
  const table: LegacyRouteRow[] = [];

  for (const route of authorizedRoutes) {
    const windows = getTodayScheduleWindows(route);
    if (windows.length === 0) continue;

    for (const window of windows) {
      for (const point of route.points) {
        table.push({
          COD_RUTA: route.code,
          DES_RUTA: route.name,
          COD_PUNTO: point.code,
          DES_PUNTO: point.name,
          TAG: point.nfcTagCode?.trim() || "",
          HOR_INI: window.startTime,
          HOR_FIN: window.endTime,
          FEC_ASIG: fecAsig,
          LAT: decToStr(point.latitude),
          LON: decToStr(point.longitude),
          ORDEN: String(point.sortOrder + 1),
        });
      }
    }
  }

  if (table.length === 0) {
    return {
      COD_ERROR: "1",
      DESC_UBI: device ? await resolveDevicePositionLabel(device) : "",
      COD_ERROR_UBI: "0000",
      EXIST_FORM: "N",
      DES_ERROR: "Sin rutas asignadas para hoy",
      Table: [] as LegacyRouteRow[],
    };
  }

  return {
    COD_ERROR: "0",
    DESC_UBI: device ? await resolveDevicePositionLabel(device) : "",
    COD_ERROR_UBI: "0000",
    EXIST_FORM: "N",
    DES_ERROR: "OK",
    Table: table,
  };
}

export async function getPatrolGeofencesForDevice(deviceId: string) {
  const authorizedRoutes = await getAuthorizedRoutesForDevice(deviceId);

  const geofences: {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
    radius: number;
    routeCode: string;
    pointCode: string;
  }[] = [];

  for (const route of authorizedRoutes) {
    for (const point of route.points) {
      if (point.latitude == null || point.longitude == null) continue;
      geofences.push({
        id: point.id,
        label: point.name,
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        radius: point.radiusM,
        routeCode: route.code,
        pointCode: point.code,
      });
    }
  }

  return { geofences };
}
