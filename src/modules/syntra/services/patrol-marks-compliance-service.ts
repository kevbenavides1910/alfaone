import { prisma } from "@/modules/core/db/prisma";
import {
  buildOmissionKey,
  getJustificationsByKeys,
  type JustificationSummary,
} from "@/modules/syntra/services/patrol-justification-service";
import { getScheduleWindowsForDate } from "@/modules/syntra/services/patrol-route-schedule-service";
import { getActivePointsForRouteOnDate } from "@/modules/syntra/services/patrol-route-point-days-service";
import {
  CR_TZ,
  patrolImeisMatch,
  patrolMarkDateForSchedule,
  patrolMarkWithinScheduleWindow,
} from "@/modules/syntra/utils/costa-rica-time";

export type PatrolMarkComplianceRow = {
  fecha: string;
  deviceId: string;
  routeId: string;
  routePointId: string;
  omissionKey: string;
  deviceLabel: string | null;
  imei: string;
  employeeCode: string;
  employeeName: string | null;
  contractName: string | null;
  zoneName: string | null;
  routeCode: string;
  routeName: string;
  pointLabel: string;
  pointCode: string;
  nfcTagCode: string;
  ventanaInicio: string;
  ventanaFin: string;
  horarioProgramado: string;
  estado: "REALIZADA" | "NO_REALIZADA";
  markedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  markId: string | null;
  justification: JustificationSummary | null;
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

export function isoDateInCostaRica(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function todayIsoInCostaRica(): string {
  return isoDateInCostaRica(new Date());
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

function tagsMatch(expected: string, actual: string | null | undefined) {
  return expected.trim().toLowerCase() === (actual ?? "").trim().toLowerCase();
}

function markWithinWindow(markedAt: Date, startTime: string, endTime: string): boolean {
  return patrolMarkWithinScheduleWindow(markedAt, startTime, endTime);
}

function formatHorarioProgramado(startTime: string, endTime: string): string {
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
  return markWithinWindow(mark.markedAt, ventanaInicio, ventanaFin);
}

export async function getPatrolMarksComplianceReport(input: {
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

  const days = eachDayInclusive(desde, hasta);
  const rows: PatrolMarkComplianceRow[] = [];

  const firstBounds = costaRicaDayBounds(input.desde);
  const lastBounds = costaRicaDayBounds(input.hasta);

  const employeeCodes = new Set<string>();

  for (const day of days) {
    const isoDay = day.toISOString().slice(0, 10);
    const { fecha } = costaRicaDayBounds(isoDay);

    const routePhones = await prisma.patrolRoutePhone.findMany({
      where: {
        route: {
          isActive: true,
          ...(input.routeId ? { id: input.routeId } : {}),
        },
      },
      include: {
        route: {
          include: {
            points: { orderBy: { sortOrder: "asc" } },
            pointDays: { select: { pointId: true, dayOfWeek: true } },
            schedules: { orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }] },
            contract: { select: { client: true, licitacionNo: true } },
            location: { include: { zone: { select: { name: true } } } },
          },
        },
      },
    });

    const deviceIds = new Set<string>();
    const deviceByAsset = new Map<
      string,
      { id: string; imei: string; label: string | null; employeeCode: string }
    >();

    for (const rp of routePhones) {
      const asset = await prisma.asset.findUnique({
        where: { id: rp.assetId },
        select: { id: true, attributes: true },
      });
      if (!asset) continue;

      const attrs = asset.attributes as Record<string, unknown>;
      const imeiVal = attrs?.imei == null ? "" : String(attrs.imei).trim();
      if (!imeiVal) continue;
      if (input.imei && imeiVal !== input.imei.trim()) continue;

      const device = await prisma.patrolDevice.findUnique({ where: { imei: imeiVal } });
      if (!device?.isActive) continue;
      if (input.deviceId && device.id !== input.deviceId) continue;

      deviceIds.add(device.id);
      employeeCodes.add(device.employeeCode);
      deviceByAsset.set(rp.assetId, {
        id: device.id,
        imei: device.imei,
        label: device.label,
        employeeCode: device.employeeCode,
      });

      const dev = deviceByAsset.get(rp.assetId)!;
      const contractName =
        rp.route.contract?.client?.trim() ||
        rp.route.contract?.licitacionNo?.trim() ||
        null;
      const zoneName = rp.route.location?.zone?.name?.trim() || null;
      const windows = getScheduleWindowsForDate(rp.route, fecha);
      if (windows.length === 0) continue;

      const activePoints = getActivePointsForRouteOnDate(rp.route, fecha);

      for (const window of windows) {
        for (const point of activePoints) {
          const tagCode = (point.nfcTagCode ?? point.code ?? "").trim();
          const pointCode = (point.code ?? "").trim();
          if (!tagCode) continue;

          rows.push({
            fecha,
            deviceId: dev.id,
            routeId: rp.route.id,
            routePointId: point.id,
            omissionKey: buildOmissionKey(
              fecha,
              dev.id,
              rp.route.id,
              point.id,
              window.startTime,
              window.endTime,
            ),
            deviceLabel: dev.label,
            imei: dev.imei,
            employeeCode: dev.employeeCode,
            employeeName: null,
            contractName,
            zoneName,
            routeCode: rp.route.code,
            routeName: rp.route.name,
            pointLabel: point.name,
            pointCode,
            nfcTagCode: tagCode,
            ventanaInicio: window.startTime,
            ventanaFin: window.endTime,
            horarioProgramado: formatHorarioProgramado(window.startTime, window.endTime),
            estado: "NO_REALIZADA",
            markedAt: null,
            latitude: null,
            longitude: null,
            markId: null,
            justification: null,
          });
        }
      }
    }

    if (deviceIds.size === 0) continue;

    const deviceImeis = [...deviceByAsset.values()].map((d) => d.imei);
    const marks = await prisma.patrolMark.findMany({
      where: {
        markType: "NFC",
        markedAt: { gte: firstBounds.start, lte: lastBounds.end },
        ...(input.imei
          ? { imei: input.imei.trim() }
          : deviceImeis.length > 0
            ? { OR: deviceImeis.map((imei) => ({ imei })) }
            : {}),
      },
      orderBy: { markedAt: "desc" },
    });

    for (const row of rows) {
      if (row.fecha !== fecha) continue;
      const hit = marks.find((m) =>
        markMatchesPointWindow(
          m,
          row.imei,
          row.nfcTagCode,
          row.pointCode,
          fecha,
          row.ventanaInicio,
          row.ventanaFin,
        ),
      );
      if (hit) {
        row.estado = "REALIZADA";
        row.markedAt = hit.markedAt.toISOString();
        row.latitude = hit.latitude != null ? Number(hit.latitude) : null;
        row.longitude = hit.longitude != null ? Number(hit.longitude) : null;
        row.markId = hit.id;
      }
    }
  }

  const employeeMap = new Map<string, { nombre: string | null; zona: string | null }>();
  if (employeeCodes.size > 0) {
    const employees = await prisma.employee.findMany({
      where: { codigoEmpleado: { in: [...employeeCodes] } },
      select: { codigoEmpleado: true, nombre: true, zona: true },
    });
    for (const e of employees) {
      employeeMap.set(e.codigoEmpleado, { nombre: e.nombre, zona: e.zona });
    }
  }

  for (const row of rows) {
    const emp = employeeMap.get(row.employeeCode);
    row.employeeName = emp?.nombre?.trim() || row.deviceLabel?.trim() || null;
    if (!row.zoneName && emp?.zona?.trim()) {
      row.zoneName = emp.zona.trim();
    }
  }

  const uniqueRows = new Map<string, PatrolMarkComplianceRow>();
  for (const row of rows) {
    uniqueRows.set(row.omissionKey, row);
  }
  const deduped = [...uniqueRows.values()];

  const justificationMap = await getJustificationsByKeys(
    deduped.filter((r) => r.estado === "NO_REALIZADA").map((r) => r.omissionKey),
  );
  for (const row of deduped) {
    row.justification = justificationMap.get(row.omissionKey) ?? null;
  }

  const esperadas = deduped.length;
  const realizadas = deduped.filter((r) => r.estado === "REALIZADA").length;
  const justificadas = deduped.filter((r) => r.estado === "NO_REALIZADA" && r.justification).length;
  const noRealizadas = esperadas - realizadas - justificadas;
  const pctCumplimiento =
    esperadas > 0 ? Math.round(((realizadas + justificadas) / esperadas) * 100) : 0;

  const recentMarks = await prisma.patrolMark.findMany({
    where: {
      markType: "NFC",
      ...(input.imei ? { imei: input.imei.trim() } : {}),
    },
    orderBy: { markedAt: "desc" },
    take: 10,
    select: {
      imei: true,
      nfcTagCode: true,
      markedAt: true,
      employeeCode: true,
    },
  });

  return {
    periodo: { desde: input.desde, hasta: input.hasta },
    timezone: CR_TZ,
    totales: {
      esperadas,
      realizadas,
      justificadas,
      noRealizadas,
      pctCumplimiento,
    },
    filas: deduped.sort((a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      a.contractName?.localeCompare(b.contractName ?? "") ||
      a.employeeName?.localeCompare(b.employeeName ?? "") ||
      a.horarioProgramado.localeCompare(b.horarioProgramado) ||
      a.pointLabel.localeCompare(b.pointLabel),
    ),
    recentMarks: recentMarks.map((m) => ({
      imei: m.imei,
      nfcTagCode: m.nfcTagCode,
      employeeCode: m.employeeCode,
      markedAt: m.markedAt.toISOString(),
      fechaCr: isoDateInCostaRica(m.markedAt),
    })),
  };
}
