import { getFingerDashboardStats } from "@/modules/finger-system/services/finger-dashboard";
import { listFingerDevices } from "@/modules/finger-system/services/finger-devices";
import { listFingerPunches } from "@/modules/finger-system/services/finger-punches-list";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { MAX_LIST, intArg, strArg } from "./shared";

export function fingerTools(): SyntraTool[] {
  return [
    {
      permission: { key: "fingerSystem.dashboard", level: "view" },
      definition: toolDef(
        "query_finger_dashboard",
        "Resumen de asistencia biométrica: empleados activos/vinculados, presentes hoy, ausentes, marcas y dispositivos.",
        { type: "object", properties: {}, additionalProperties: false },
      ),
      describeCall: () => "Consultando asistencia biométrica…",
      handler: async () => {
        const stats = await getFingerDashboardStats();
        return {
          empleadosActivos: stats.employeesActive,
          empleadosVinculados: stats.employeesLinked,
          presentesHoy: stats.employeesPresentToday,
          ausentesHoy: stats.employeesAbsentToday,
          llegadasTarde: stats.lateArrivalsToday,
          horasExtra: stats.overtimeToday,
          dispositivosOnline: stats.devicesOnline,
          dispositivosOffline: stats.devicesOffline,
          marcasHoy: stats.punchesToday,
          ultimaSync: stats.lastSyncAt,
          fuente: "Finger System Alfa One",
        };
      },
    },
    {
      permission: { key: "fingerSystem.marcasEnVivo", level: "view" },
      definition: toolDef(
        "list_finger_punches",
        "Lista marcas biométricas recientes (relojes ZK y/o ATT2016) con filtros por fecha, búsqueda y origen.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Buscar por badge, nombre o código" },
            from: { type: "string", description: "Fecha desde YYYY-MM-DD" },
            to: { type: "string", description: "Fecha hasta YYYY-MM-DD" },
            source: {
              type: "string",
              enum: ["DEVICE", "ATT2016"],
              description: "Origen: DEVICE=reloj ZK, ATT2016=legado",
            },
            limit: { type: "integer", description: "Máximo de filas (default 20)" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) =>
        args?.q
          ? `Buscando marcas «${String(args.q)}»…`
          : "Consultando historial de marcas biométricas…",
      handler: async (_session, args) => {
        const sourceRaw = strArg(args, "source");
        const source =
          sourceRaw === "DEVICE" || sourceRaw === "ATT2016" ? sourceRaw : undefined;
        const limit = intArg(args, "limit", 20, MAX_LIST);
        const data = await listFingerPunches({
          page: 1,
          pageSize: limit,
          q: strArg(args, "q") || undefined,
          from: strArg(args, "from") || undefined,
          to: strArg(args, "to") || undefined,
          source,
        });
        return {
          total: data.total,
          marcas: data.rows.slice(0, MAX_LIST).map((r) => ({
            fecha: r.checkTime,
            badge: r.badgeNumber ?? r.attUserId,
            empleado: r.employeeName,
            codigo: r.employeeCodigo,
            reloj: r.deviceName ?? r.deviceSn,
            origen: r.source,
            tipo: r.checkType,
          })),
          fuente: "Finger System / relojes ZK + ATT2016",
        };
      },
    },
    {
      permission: { key: "fingerSystem.dispositivos", level: "view" },
      definition: toolDef(
        "list_finger_devices",
        "Lista relojes biométricos Finger System (ZKTeco): nombre, IP, estado, contadores.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Buscar por nombre, IP o serial" },
            limit: { type: "integer", description: "Máximo de filas (default 25)" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando relojes biométricos…",
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 25, MAX_LIST);
        const data = await listFingerDevices({
          page: 1,
          pageSize: limit,
          q: strArg(args, "q") || undefined,
        });
        return {
          total: data.total,
          dispositivos: data.items.slice(0, MAX_LIST).map((d) => ({
            nombre: d.name,
            ip: d.ipAddress,
            puerto: d.port,
            estado: d.status,
            modelo: d.model ?? d.brand,
            usuarios: d.employeeCount,
            huellas: d.fingerprintCount,
            marcas: d.punchCount,
            ultimaSync: d.lastSyncAt,
          })),
          fuente: "Finger System / finger_devices",
        };
      },
    },
  ];
}
