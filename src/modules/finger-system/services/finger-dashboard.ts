import { prisma } from "@/modules/core/db/prisma";
import { isEmployeeEstadoActivo } from "@/modules/empleados/business/employee-identity";
import { probeAtt2016Connection } from "@/modules/finger-system/integrations/att2016/adapter";
import { countFingerPunchesToday } from "./att2016-punches-import";
import { getFingerAttendanceSummaryForDate } from "./finger-attendance-calc";
import { getFingerSettingsPublic } from "./finger-settings";

export type FingerDashboardStats = {
  employeesActive: number;
  employeesLinked: number;
  employeesPresentToday: number;
  employeesAbsentToday: number;
  lateArrivalsToday: number;
  overtimeToday: number;
  devicesOnline: number;
  devicesOffline: number;
  punchesToday: number;
  lastSyncAt: string | null;
  att2016: Awaited<ReturnType<typeof probeAtt2016Connection>>;
  settings: Awaited<ReturnType<typeof getFingerSettingsPublic>>;
};

export async function getFingerDashboardStats(): Promise<FingerDashboardStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    employees,
    employeesLinked,
    devices,
    lastSync,
    att2016,
    settings,
    punchesTodayCount,
    attendanceToday,
  ] = await Promise.all([
    prisma.employee.findMany({
      select: { id: true, estado: true },
    }),
    prisma.fingerEmployeeLink.count(),
    prisma.fingerDevice.findMany({
      where: { isActive: true },
      select: { status: true, lastSyncAt: true },
    }),
    prisma.fingerSyncLog.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
    probeAtt2016Connection(),
    getFingerSettingsPublic(),
    countFingerPunchesToday(),
    getFingerAttendanceSummaryForDate(todayStart).catch(() => ({
      employeesPresentToday: 0,
      employeesAbsentToday: 0,
      lateArrivalsToday: 0,
      present: 0,
      late: 0,
      incomplete: 0,
      absent: 0,
      earlyLeave: 0,
    })),
  ]);

  const employeesActive = employees.filter((e) => isEmployeeEstadoActivo(e.estado)).length;
  const devicesOnline = devices.filter((d) => d.status === "ONLINE").length;
  const devicesOffline = devices.filter((d) => d.status === "OFFLINE" || d.status === "UNKNOWN").length;

  return {
    employeesActive,
    employeesLinked,
    employeesPresentToday: attendanceToday.employeesPresentToday,
    employeesAbsentToday: attendanceToday.employeesAbsentToday,
    lateArrivalsToday: attendanceToday.lateArrivalsToday,
    overtimeToday: 0,
    devicesOnline,
    devicesOffline,
    punchesToday: punchesTodayCount,
    lastSyncAt: lastSync?.finishedAt?.toISOString() ?? null,
    att2016,
    settings,
  };
}

export type FingerDiagnosticItem = {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  message: string;
};

export async function getFingerSystemDiagnostic(): Promise<FingerDiagnosticItem[]> {
  const [stats, dbOk] = await Promise.all([
    getFingerDashboardStats(),
    prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`.then(() => true).catch(() => false),
  ]);

  return [
    {
      id: "database",
      label: "Base de datos",
      status: dbOk ? "ok" : "error",
      message: dbOk ? "PostgreSQL Finger System operativa." : "No fue posible consultar la base de datos.",
    },
    {
      id: "services",
      label: "Servicios",
      status: "ok",
      message: "API Finger System disponible.",
    },
    {
      id: "att2016",
      label: "Base biométrica ATT2016",
      status: stats.att2016.reachable ? "ok" : stats.att2016.configured ? "warn" : "error",
      message: stats.att2016.message,
    },
    {
      id: "devices",
      label: "Dispositivos",
      status: stats.devicesOnline > 0 ? "ok" : "warn",
      message:
        stats.devicesOnline + stats.devicesOffline > 0
          ? `${stats.devicesOnline} en línea, ${stats.devicesOffline} fuera de línea o desconocidos.`
          : "Sin dispositivos registrados.",
    },
    {
      id: "sync",
      label: "Sincronización",
      status: stats.lastSyncAt ? "ok" : "warn",
      message: stats.lastSyncAt
        ? `Última sincronización exitosa: ${stats.lastSyncAt}`
        : "Aún no hay sincronizaciones exitosas.",
    },
    {
      id: "reports",
      label: "Reportes de asistencia",
      status: stats.employeesPresentToday > 0 || stats.punchesToday > 0 ? "ok" : "warn",
      message:
        stats.punchesToday > 0
          ? `${stats.punchesToday} marcas hoy; calcule asistencia para reportes detallados.`
          : "Importe marcas y calcule asistencia para habilitar reportes.",
    },
    {
      id: "backups",
      label: "Backups",
      status: stats.settings.backupPath ? "ok" : "warn",
      message: stats.settings.backupPath
        ? `Ruta configurada: ${stats.settings.backupPath}`
        : "Ruta por defecto: APP_DATA_ROOT/finger-backups",
    },
  ];
}
