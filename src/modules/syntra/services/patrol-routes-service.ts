import { prisma } from "@/modules/core/db/prisma";

import {

  legacyDateTodayCostaRica,

  patrolImeisMatch,

  patrolMarkDateForSchedule,
  patrolMarkWithinScheduleWindow,
} from "@/modules/syntra/utils/costa-rica-time";

import { assetImeiFromAttributes, resolveDevicePositionLabel } from "@/modules/syntra/services/patrol-inventory-phone-service";

import { resolveDeviceAssetId } from "@/modules/syntra/services/patrol-route-phone-service";

import { getTodayScheduleWindows } from "@/modules/syntra/services/patrol-route-schedule-service";

import { todayIsoInCostaRica } from "@/modules/syntra/services/patrol-marks-compliance-service";



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

  IND_ESTADO: string;

};



function decToStr(v: { toString(): string } | null | undefined): string {

  if (v == null) return "";

  return v.toString();

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



function tagsMatch(expected: string, actual: string | null | undefined) {

  return expected.trim().toLowerCase() === (actual ?? "").trim().toLowerCase();

}



function markWithinWindow(markedAt: Date, startTime: string, endTime: string): boolean {
  return patrolMarkWithinScheduleWindow(markedAt, startTime, endTime);
}



function markMatchesRoutePoint(

  mark: { imei: string; nfcTagCode: string | null; markedAt: Date },

  routeImeis: string[],

  tagCode: string,

  pointCode: string,

  fecha: string,

  ventanaInicio: string,

  ventanaFin: string,

) {

  const fromRoutePhone = routeImeis.some((imei) => patrolImeisMatch(imei, mark.imei));

  if (!fromRoutePhone) return false;

  if (patrolMarkDateForSchedule(mark.markedAt, fecha) !== fecha) return false;

  if (!tagsMatch(tagCode, mark.nfcTagCode) && !tagsMatch(pointCode, mark.nfcTagCode)) return false;

  return markWithinWindow(mark.markedAt, ventanaInicio, ventanaFin);

}



async function buildRouteImeisMap(routeIds: string[]): Promise<Map<string, string[]>> {

  const map = new Map<string, string[]>();

  if (routeIds.length === 0) return map;



  const routePhones = await prisma.patrolRoutePhone.findMany({

    where: { routeId: { in: routeIds } },

    select: { routeId: true, assetId: true },

  });

  if (routePhones.length === 0) return map;



  const assets = await prisma.asset.findMany({

    where: { id: { in: [...new Set(routePhones.map((r) => r.assetId))] } },

    select: { id: true, attributes: true },

  });

  const imeiByAsset = new Map(

    assets.map((a) => [a.id, assetImeiFromAttributes(a.attributes).trim()]),

  );



  for (const rp of routePhones) {

    const imei = imeiByAsset.get(rp.assetId) ?? "";

    if (!imei) continue;

    const list = map.get(rp.routeId) ?? [];

    if (!list.some((existing) => patrolImeisMatch(existing, imei))) {

      list.push(imei);

    }

    map.set(rp.routeId, list);

  }

  return map;

}



export async function getAuthorizedRoutesForDevice(deviceId: string) {

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

    let windows = getTodayScheduleWindows(route);

    if (windows.length === 0) {

      windows = [{ startTime: "00:00", endTime: "23:59" }];

    }



    for (const window of windows) {

      for (const point of route.points) {

        table.push({

          COD_RUTA: route.code,

          DES_RUTA: route.name,

          COD_PUNTO: point.code,

          DES_PUNTO: point.name,

          TAG: point.nfcTagCode?.trim() || point.code,

          HOR_INI: window.startTime,

          HOR_FIN: window.endTime,

          FEC_ASIG: fecAsig,

          LAT: decToStr(point.latitude),

          LON: decToStr(point.longitude),

          ORDEN: String(point.sortOrder + 1),

          IND_ESTADO: "P",

        });

      }

    }

  }



  if (table.length > 0) {

    const fecha = todayIsoInCostaRica();

    const bounds = costaRicaDayBounds(fecha);

    const routeIdByCode = new Map(authorizedRoutes.map((r) => [r.code, r.id]));

    const routeImeis = await buildRouteImeisMap(authorizedRoutes.map((r) => r.id));



    const marks = await prisma.patrolMark.findMany({

      where: {

        markType: "NFC",

        markedAt: { gte: bounds.start, lte: bounds.end },

      },

      orderBy: { markedAt: "desc" },

      select: { imei: true, nfcTagCode: true, markedAt: true },

    });



    for (const row of table) {

      const routeId = routeIdByCode.get(row.COD_RUTA);

      if (!routeId) continue;

      const imeis = routeImeis.get(routeId) ?? [];

      if (imeis.length === 0) continue;



      const tagCode = row.TAG.trim();

      const pointCode = row.COD_PUNTO.trim();

      const hit = marks.some((m) =>

        markMatchesRoutePoint(m, imeis, tagCode, pointCode, fecha, row.HOR_INI, row.HOR_FIN),

      );

      if (hit) {

        row.IND_ESTADO = "PRC";

      }

    }

  }



  if (table.length === 0) {

    const hasRoutes = authorizedRoutes.length > 0;

    return {

      COD_ERROR: hasRoutes ? "0" : "1",

      DESC_UBI: device ? await resolveDevicePositionLabel(device) : "",

      COD_ERROR_UBI: "0000",

      EXIST_FORM: "N",

      DES_ERROR: hasRoutes ? "Sin puntos activos hoy (revise horarios)" : "Sin rutas asignadas para hoy",

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


