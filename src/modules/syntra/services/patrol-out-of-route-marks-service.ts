import { prisma } from "@/modules/core/db/prisma";
import { getScheduleWindowsForDate } from "@/modules/syntra/services/patrol-route-schedule-service";
import { getPointsForDate } from "@/modules/syntra/services/patrol-route-point-day-service";
import {
  patrolImeisMatch,
  patrolMarkDateForSchedule,
  patrolMarkDateIsoInCr,
  patrolMarkWithinScheduleWindow,
} from "@/modules/syntra/utils/costa-rica-time";

export type OutOfRouteMarkMotivo =
  | "TAG_NO_REGISTRADO"
  | "TELEFONO_NO_ASIGNADO"
  | "FUERA_DE_HORARIO"
  | "SIN_HORARIO_HOY";

export type OutOfRouteMarkRow = {
  markId: string;
  markedAt: string;
  fecha: string;
  imei: string;
  deviceId: string | null;
  deviceLabel: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  nfcTagCode: string | null;
  routeCode: string | null;
  routeName: string | null;
  pointLabel: string | null;
  pointCode: string | null;
  positionName: string | null;
  locationName: string | null;
  horarioProgramado: string | null;
  motivo: OutOfRouteMarkMotivo;
  motivoLabel: string;
  latitude: number | null;
  longitude: number | null;
};

const MOTIVO_LABELS: Record<OutOfRouteMarkMotivo, string> = {
  TAG_NO_REGISTRADO: "Tag no registrado en ninguna ruta",
  TELEFONO_NO_ASIGNADO: "Teléfono no asignado a la ruta del tag",
  FUERA_DE_HORARIO: "Fuera del horario programado",
  SIN_HORARIO_HOY: "Ruta sin horario hoy",
};

type RouteBundle = {
  id: string;
  code: string;
  name: string;
  openSchedule: boolean;
  samePointsEveryDay: boolean;
  schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
  locationName: string | null;
  points: {
    id: string;
    code: string;
    name: string;
    nfcTagCode: string | null;
    positionName: string | null;
  }[];
  pointDays: { pointId: string; dayOfWeek: number }[];
};

type PointRef = {
  routeId: string;
  routeCode: string;
  routeName: string;
  locationName: string | null;
  pointId: string;
  pointLabel: string;
  pointCode: string;
  nfcTagCode: string;
  positionName: string | null;
};

function parseDateOnly(raw: string): Date {
  const d = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Fecha invalida");
  }
  return d;
}

function eachDayInclusive(desde: Date, hasta: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(desde);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(hasta);
  end.setUTCHours(0, 0, 0, 0);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

function costaRicaDayBounds(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextIso = next.toISOString().slice(0, 10);
  return {
    start: new Date(`${isoDate}T06:00:00.000Z`),
    end: new Date(`${nextIso}T05:59:59.999Z`),
    fecha: isoDate,
  };
}

function normalizeTag(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function tagsMatch(expected: string, actual: string | null | undefined): boolean {
  return normalizeTag(expected) === normalizeTag(actual);
}

function formatHorario(startTime: string, endTime: string): string {
  if (startTime === "00:00" && endTime === "23:59") return "24 h";
  return `${startTime} – ${endTime}`;
}

function markMatchesPointWindow(
  mark: { imei: string; nfcTagCode: string | null; markedAt: Date },
  deviceImei: string,
  tagCode: string,
  pointCode: string,
  fecha: string,
  ventanaInicio: string,
  ventanaFin: string,
) {
  if (!patrolImeisMatch(mark.imei, deviceImei)) return false;
  if (patrolMarkDateForSchedule(mark.markedAt, fecha) !== fecha) return false;
  if (!tagsMatch(tagCode, mark.nfcTagCode) && !tagsMatch(pointCode, mark.nfcTagCode)) return false;
  return patrolMarkWithinScheduleWindow(mark.markedAt, ventanaInicio, ventanaFin);
}

async function loadRoutes(routeId?: string): Promise<Map<string, RouteBundle>> {
  const routes = await prisma.patrolRoute.findMany({
    where: {
      isActive: true,
      ...(routeId ? { id: routeId } : {}),
    },
    include: {
      points: {
        orderBy: { sortOrder: "asc" },
        include: { position: { select: { name: true } } },
      },
      schedules: { orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }] },
      pointDays: { select: { pointId: true, dayOfWeek: true } },
      location: { select: { name: true } },
    },
  });

  const map = new Map<string, RouteBundle>();
  for (const route of routes) {
    map.set(route.id, {
      id: route.id,
      code: route.code,
      name: route.name,
      openSchedule: route.openSchedule,
      samePointsEveryDay: route.samePointsEveryDay,
      schedules: route.schedules.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      locationName: route.location?.name?.trim() || null,
      pointDays: route.pointDays.map((pd) => ({
        pointId: pd.pointId,
        dayOfWeek: pd.dayOfWeek,
      })),
      points: route.points.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        nfcTagCode: p.nfcTagCode,
        positionName: p.position?.name?.trim() || null,
      })),
    });
  }
  return map;
}

async function loadAuthorizedRoutesByImei(
  routesById: Map<string, RouteBundle>,
  imeiFilter?: string,
  deviceIdFilter?: string,
): Promise<Map<string, Set<string>>> {
  const routePhones = await prisma.patrolRoutePhone.findMany({
    where: { routeId: { in: [...routesById.keys()] } },
    select: { routeId: true, assetId: true },
  });

  const byImei = new Map<string, Set<string>>();

  for (const rp of routePhones) {
    const asset = await prisma.asset.findUnique({
      where: { id: rp.assetId },
      select: { attributes: true },
    });
    if (!asset) continue;

    const attrs = asset.attributes as Record<string, unknown>;
    const imei = attrs?.imei == null ? "" : String(attrs.imei).trim();
    if (!imei) continue;
    if (imeiFilter && !patrolImeisMatch(imei, imeiFilter)) continue;

    const device = await prisma.patrolDevice.findUnique({ where: { imei } });
    if (!device?.isActive) continue;
    if (deviceIdFilter && device.id !== deviceIdFilter) continue;

    const set = byImei.get(imei) ?? new Set<string>();
    set.add(rp.routeId);
    byImei.set(imei, set);
  }

  return byImei;
}

function buildPointsByTag(routesById: Map<string, RouteBundle>): Map<string, PointRef[]> {
  const map = new Map<string, PointRef[]>();
  for (const route of routesById.values()) {
    for (const point of route.points) {
      const tags = new Set<string>();
      const tagCode = (point.nfcTagCode ?? point.code ?? "").trim();
      if (tagCode) tags.add(normalizeTag(tagCode));
      if (point.code.trim()) tags.add(normalizeTag(point.code));

      for (const tag of tags) {
        const list = map.get(tag) ?? [];
        list.push({
          routeId: route.id,
          routeCode: route.code,
          routeName: route.name,
          locationName: route.locationName,
          pointId: point.id,
          pointLabel: point.name,
          pointCode: point.code,
          nfcTagCode: tagCode || point.code,
          positionName: point.positionName,
        });
        map.set(tag, list);
      }
    }
  }
  return map;
}

async function collectValidMarkIds(input: {
  desde: string;
  hasta: string;
  routesById: Map<string, RouteBundle>;
  authorizedByImei: Map<string, Set<string>>;
  imei?: string;
  deviceId?: string;
}): Promise<Set<string>> {
  const valid = new Set<string>();
  const days = eachDayInclusive(parseDateOnly(input.desde), parseDateOnly(input.hasta));
  const firstBounds = costaRicaDayBounds(input.desde);
  const lastBounds = costaRicaDayBounds(input.hasta);

  const deviceImeis = [...input.authorizedByImei.keys()];
  if (deviceImeis.length === 0 && !input.imei) {
    return valid;
  }

  const marks = await prisma.patrolMark.findMany({
    where: {
      markType: "NFC",
      markedAt: { gte: firstBounds.start, lte: lastBounds.end },
      ...(input.imei
        ? { imei: input.imei.trim() }
        : deviceImeis.length > 0
          ? { OR: deviceImeis.flatMap((imei) => [{ imei }, { imei: imei.padStart(15, "0") }]) }
          : {}),
    },
    orderBy: { markedAt: "asc" },
  });

  for (const day of days) {
    const isoDay = day.toISOString().slice(0, 10);
    const { fecha } = costaRicaDayBounds(isoDay);

    for (const route of input.routesById.values()) {
      const windows = getScheduleWindowsForDate(route, fecha);
      if (windows.length === 0) continue;

      for (const point of getPointsForDate(route, fecha)) {
        const tagCode = (point.nfcTagCode ?? point.code ?? "").trim();
        if (!tagCode) continue;

        for (const window of windows) {
          for (const [imei, routeIds] of input.authorizedByImei.entries()) {
            if (!routeIds.has(route.id)) continue;
            const hit = marks.find((m) =>
              markMatchesPointWindow(
                m,
                imei,
                tagCode,
                point.code,
                fecha,
                window.startTime,
                window.endTime,
              ),
            );
            if (hit) valid.add(hit.id);
          }
        }
      }
    }
  }

  return valid;
}

function classifyMark(
  mark: {
    id: string;
    imei: string;
    nfcTagCode: string | null;
    markedAt: Date;
    latitude: unknown;
    longitude: unknown;
    employeeCode: string | null;
  },
  routesById: Map<string, RouteBundle>,
  authorizedRouteIds: Set<string>,
  pointsByTag: Map<string, PointRef[]>,
): Pick<
  OutOfRouteMarkRow,
  | "motivo"
  | "motivoLabel"
  | "routeCode"
  | "routeName"
  | "pointLabel"
  | "pointCode"
  | "positionName"
  | "locationName"
  | "horarioProgramado"
> {
  const tagKey = normalizeTag(mark.nfcTagCode);
  const tagPoints = pointsByTag.get(tagKey) ?? [];

  if (tagPoints.length === 0) {
    return {
      motivo: "TAG_NO_REGISTRADO",
      motivoLabel: MOTIVO_LABELS.TAG_NO_REGISTRADO,
      routeCode: null,
      routeName: null,
      pointLabel: null,
      pointCode: null,
      positionName: null,
      locationName: null,
      horarioProgramado: null,
    };
  }

  const fecha = patrolMarkDateIsoInCr(mark.markedAt);
  const tagRouteIds = [...new Set(tagPoints.map((p) => p.routeId))];
  const authorizedForTag = tagRouteIds.filter((id) => authorizedRouteIds.has(id));
  const ref = tagPoints.find((p) => authorizedForTag.includes(p.routeId)) ?? tagPoints[0];

  if (authorizedForTag.length === 0) {
    return {
      motivo: "TELEFONO_NO_ASIGNADO",
      motivoLabel: MOTIVO_LABELS.TELEFONO_NO_ASIGNADO,
      routeCode: ref.routeCode,
      routeName: ref.routeName,
      pointLabel: ref.pointLabel,
      pointCode: ref.pointCode,
      positionName: ref.positionName,
      locationName: ref.locationName,
      horarioProgramado: null,
    };
  }

  const route = routesById.get(ref.routeId);
  const windows = route ? getScheduleWindowsForDate(route, fecha) : [];

  if (windows.length === 0) {
    return {
      motivo: "SIN_HORARIO_HOY",
      motivoLabel: MOTIVO_LABELS.SIN_HORARIO_HOY,
      routeCode: ref.routeCode,
      routeName: ref.routeName,
      pointLabel: ref.pointLabel,
      pointCode: ref.pointCode,
      positionName: ref.positionName,
      locationName: ref.locationName,
      horarioProgramado: null,
    };
  }

  return {
    motivo: "FUERA_DE_HORARIO",
    motivoLabel: MOTIVO_LABELS.FUERA_DE_HORARIO,
    routeCode: ref.routeCode,
    routeName: ref.routeName,
    pointLabel: ref.pointLabel,
    pointCode: ref.pointCode,
    positionName: null,
    locationName: ref.locationName,
    horarioProgramado: windows.map((w) => formatHorario(w.startTime, w.endTime)).join(", "),
  };
}

export async function getOutOfRouteMarksReport(input: {
  desde: string;
  hasta: string;
  deviceId?: string;
  imei?: string;
  routeId?: string;
}) {
  const desde = parseDateOnly(input.desde);
  const hasta = parseDateOnly(input.hasta);
  if (desde > hasta) {
    throw new Error("La fecha inicial no puede ser mayor que la final");
  }

  const firstBounds = costaRicaDayBounds(input.desde);
  const lastBounds = costaRicaDayBounds(input.hasta);
  const routesById = await loadRoutes(input.routeId);
  const authorizedByImei = await loadAuthorizedRoutesByImei(
    routesById,
    input.imei,
    input.deviceId,
  );
  const pointsByTag = buildPointsByTag(routesById);

  const validMarkIds = await collectValidMarkIds({
    desde: input.desde,
    hasta: input.hasta,
    routesById,
    authorizedByImei,
    imei: input.imei,
    deviceId: input.deviceId,
  });

  const marks = await prisma.patrolMark.findMany({
    where: {
      markType: "NFC",
      markedAt: { gte: firstBounds.start, lte: lastBounds.end },
      ...(input.imei ? { imei: input.imei.trim() } : {}),
    },
    orderBy: { markedAt: "desc" },
  });

  const devices = await prisma.patrolDevice.findMany({
    where: { isActive: true },
    select: { id: true, imei: true, label: true, employeeCode: true },
  });
  const deviceByImei = new Map<string, (typeof devices)[number]>();
  for (const d of devices) {
    deviceByImei.set(d.imei, d);
  }

  const employeeCodes = new Set<string>();
  for (const d of devices) employeeCodes.add(d.employeeCode);
  for (const m of marks) {
    if (m.employeeCode) employeeCodes.add(m.employeeCode);
  }

  const employeeMap = new Map<string, string>();
  if (employeeCodes.size > 0) {
    const employees = await prisma.employee.findMany({
      where: { codigoEmpleado: { in: [...employeeCodes] } },
      select: { codigoEmpleado: true, nombre: true },
    });
    for (const e of employees) {
      employeeMap.set(e.codigoEmpleado, e.nombre?.trim() || e.codigoEmpleado);
    }
  }

  const rows: OutOfRouteMarkRow[] = [];

  for (const mark of marks) {
    if (validMarkIds.has(mark.id)) continue;
    if (input.deviceId) {
      const dev = deviceByImei.get(mark.imei);
      if (!dev || dev.id !== input.deviceId) continue;
    }

    const device =
      deviceByImei.get(mark.imei) ??
      [...deviceByImei.values()].find((d) => patrolImeisMatch(d.imei, mark.imei)) ??
      null;

    const authorizedRouteIds =
      authorizedByImei.get(mark.imei) ??
      [...authorizedByImei.entries()].find(([imei]) => patrolImeisMatch(imei, mark.imei))?.[1] ??
      new Set<string>();

    const classified = classifyMark(
      mark,
      routesById,
      authorizedRouteIds,
      pointsByTag,
    );

    const employeeCode = mark.employeeCode ?? device?.employeeCode ?? null;
    rows.push({
      markId: mark.id,
      markedAt: mark.markedAt.toISOString(),
      fecha: patrolMarkDateIsoInCr(mark.markedAt),
      imei: mark.imei,
      deviceId: device?.id ?? null,
      deviceLabel: device?.label ?? null,
      employeeCode,
      employeeName: employeeCode ? employeeMap.get(employeeCode) ?? device?.label ?? null : null,
      nfcTagCode: mark.nfcTagCode,
      latitude: mark.latitude != null ? Number(mark.latitude) : null,
      longitude: mark.longitude != null ? Number(mark.longitude) : null,
      ...classified,
    });
  }

  const byMotivo = rows.reduce(
    (acc, row) => {
      acc[row.motivo] = (acc[row.motivo] ?? 0) + 1;
      return acc;
    },
    {} as Record<OutOfRouteMarkMotivo, number>,
  );

  return {
    periodo: { desde: input.desde, hasta: input.hasta },
    totales: {
      fueraDeRuta: rows.length,
      tagNoRegistrado: byMotivo.TAG_NO_REGISTRADO ?? 0,
      telefonoNoAsignado: byMotivo.TELEFONO_NO_ASIGNADO ?? 0,
      fueraDeHorario: byMotivo.FUERA_DE_HORARIO ?? 0,
      sinHorarioHoy: byMotivo.SIN_HORARIO_HOY ?? 0,
    },
    filas: rows.sort((a, b) => b.markedAt.localeCompare(a.markedAt)),
  };
}
