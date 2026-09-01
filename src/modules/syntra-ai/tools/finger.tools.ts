import { getFingerDashboardStats } from "@/modules/finger-system/services/finger-dashboard";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";

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
  ];
}
