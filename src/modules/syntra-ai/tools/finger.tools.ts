import { getFingerDashboardStats } from "@/modules/finger-system/services/finger-dashboard";
import { listFingerDevicesPreferOdoo } from "@/modules/finger-system/services/odoo-biometric-devices";
import { listFingerPunchesPreferOdoo } from "@/modules/finger-system/services/odoo-biometric-punches";
import { countOdooBiometricSummary } from "@/modules/finger-system/services/odoo-biometric-write";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { MAX_LIST, intArg, strArg } from "./shared";

export function fingerTools(): SyntraTool[] {
  return [
    {
      permission: { key: "fingerSystem.dashboard", level: "view" },
      definition: toolDef(
        "query_finger_dashboard",
        "Resumen de asistencia biométrica: empleados, marcas, dispositivos. Incluye conteos Odoo si está configurado.",
        { type: "object", properties: {}, additionalProperties: false },
      ),
      describeCall: () => "Consultando asistencia biométrica…",
      handler: async () => {
        const [stats, odoo] = await Promise.all([
          getFingerDashboardStats(),
          countOdooBiometricSummary(),
        ]);
        return {
          empleadosActivos: stats.employeesActive,
          empleadosVinculados: stats.employeesLinked,
          presentesHoy: stats.employeesPresentToday,
          ausentesHoy: stats.employeesAbsentToday,
          dispositivosOnline: stats.devicesOnline,
          dispositivosOffline: stats.devicesOffline,
          marcasHoy: stats.punchesToday,
          ultimaSync: stats.lastSyncAt,
          odoo: odoo
            ? { relojes: odoo.devices, usuarios: odoo.users, marcas: odoo.punches }
            : null,
          fuente: odoo ? "Finger System + Odoo alfa_biometric" : "Finger System Alfa One",
        };
      },
    },
    {
      permission: { key: "fingerSystem.marcasEnVivo", level: "view" },
      definition: toolDef(
        "list_finger_punches",
        "Lista marcas biométricas (prioriza Odoo alfa_biometric_punch si hay ODOO_BIOMETRIC_DATABASE_URL).",
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
        const data = await listFingerPunchesPreferOdoo({
          page: 1,
          pageSize: limit,
          q: strArg(args, "q") || undefined,
          from: strArg(args, "from") || undefined,
          to: strArg(args, "to") || undefined,
          source,
        });
        return {
          total: data.total,
          origenDatos: data.source,
          marcas: data.rows.slice(0, MAX_LIST).map((r) => ({
            fecha: r.checkTime,
            badge: r.badgeNumber ?? r.attUserId,
            empleado: r.employeeName,
            codigo: r.employeeCodigo,
            reloj: r.deviceName ?? r.deviceSn,
            origen: r.source,
            tipo: r.checkType,
          })),
          fuente: data.source === "odoo" ? "Odoo alfa_biometric_punch" : "Finger finger_punches",
        };
      },
    },
    {
      permission: { key: "fingerSystem.dispositivos", level: "view" },
      definition: toolDef(
        "list_finger_devices",
        "Lista relojes biométricos (prioriza Odoo alfa_biometric_device).",
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
        const data = await listFingerDevicesPreferOdoo({
          page: 1,
          pageSize: limit,
          q: strArg(args, "q") || undefined,
        });
        return {
          total: data.total,
          origenDatos: data.source,
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
          fuente: data.source === "odoo" ? "Odoo alfa_biometric_device" : "Finger finger_devices",
        };
      },
    },
  ];
}
