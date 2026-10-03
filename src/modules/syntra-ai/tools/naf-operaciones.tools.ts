import { listOpAsistencia } from "@/modules/naf-operaciones/services/list-asistencia-rol";
import { listOpRoles } from "@/modules/naf-operaciones/services/list-roles";
import { listOpVacantes } from "@/modules/naf-operaciones/services/list-vacantes";
import {
  CALENDARIO_RECURRENCE_LABELS,
  CALENDARIO_STATUS_LABELS,
  toIsoDate,
} from "@/modules/naf-operaciones/business/calendario-types";
import { listCalendarioEvents } from "@/modules/naf-operaciones/services/calendario-eventos";
import {
  listCalendarioAdminCandidates,
  listCalendarioZones,
} from "@/modules/naf-operaciones/services/calendario-opciones";
import { listCalendarioEventTypes } from "@/modules/naf-operaciones/services/calendario-tipos";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function nafOperacionesTools(): SyntraTool[] {
  return [
    {
      permission: { key: "nafOperaciones.roles", level: "view" },
      definition: toolDef(
        "list_op_roles",
        "Roles OP en Oracle NAF con propietario de la semana.",
        {
          type: "object",
          properties: {
            noContrato: { type: "string" },
            nombre: { type: "string", description: "Nombre del propietario." },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando roles OP…",
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 20, 50);
        const result = await listOpRoles({
          noContrato: strArg(args, "noContrato") || undefined,
          q: strArg(args, "nombre") || undefined,
          pageSize: limit,
        });
        return {
          roles: result.rows.slice(0, limit).map((r) => ({
            noRol: r.noRol,
            contrato: r.noContrato,
            propietario: r.noEmple,
            nombrePropietario: r.nombreEmpleado,
            ubicacion: r.ubicacionNombre,
          })),
          meta: { total: result.total, page: result.page, pageSize: result.pageSize },
          fuente: "NAF Operaciones — roles",
        };
      },
    },
    {
      permission: { key: "nafOperaciones.asistencia", level: "view" },
      definition: toolDef(
        "list_op_asistencia",
        "Asistencia OP por fecha/semana: marcas e inconsistencias.",
        {
          type: "object",
          properties: {
            fecha: { type: "string", description: "YYYY-MM-DD" },
            nombre: { type: "string" },
            inconsistentesOnly: { type: "boolean" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando asistencia OP…",
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 20, 50);
        const result = await listOpAsistencia({
          fecha: strArg(args, "fecha") || undefined,
          nombre: strArg(args, "nombre") || undefined,
          inconsistentesOnly: args.inconsistentesOnly === true,
          pageSize: limit,
        });
        return {
          registros: result.rows.slice(0, limit),
          meta: { total: result.total, page: result.page, pageSize: result.pageSize },
          fuente: "NAF Operaciones — asistencia",
        };
      },
    },
    {
      permission: { key: "nafOperaciones.vacantes", level: "view" },
      definition: toolDef(
        "list_op_vacantes",
        "Roles OP activos sin propietario asignado esta semana.",
        {
          type: "object",
          properties: {
            noContrato: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando vacantes OP…",
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 20, 50);
        const result = await listOpVacantes({
          noContrato: strArg(args, "noContrato") || undefined,
          pageSize: limit,
        });
        return {
          vacantes: result.rows.slice(0, limit),
          meta: { total: result.total, page: result.page, pageSize: result.pageSize },
          fuente: "NAF Operaciones — vacantes",
        };
      },
    },
    {
      permission: { key: "nafOperaciones.calendario", level: "view" },
      definition: toolDef(
        "list_operational_calendar_events",
        "Eventos del calendario operativo (cambio de uniformes, entregas, inspecciones…) por rango de fechas, zona, tipo, administrador asignado o estado (pendiente/realizada), con avance por contrato y cantidad de evidencias.",
        {
          type: "object",
          properties: {
            desde: { type: "string", description: "YYYY-MM-DD (por defecto inicio del mes actual)." },
            hasta: { type: "string", description: "YYYY-MM-DD (por defecto fin del mes actual)." },
            zona: { type: "string", description: "Nombre (o parte) de la zona operativa." },
            tipo: { type: "string", description: "Nombre (o parte) del tipo de evento, ej. «uniformes»." },
            administrador: {
              type: "string",
              description: "Nombre (o parte) del usuario administrador asignado; «yo» = el usuario actual.",
            },
            estado: { type: "string", enum: ["pendiente", "realizada", "cancelada"] },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando calendario operativo…",
      handler: async (session, args) => {
        const limit = intArg(args, "limit", 30, 100);
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
        const desde = strArg(args, "desde") || toIsoDate(monthStart);
        const hasta = strArg(args, "hasta") || toIsoDate(monthEnd);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
          return { error: "Fechas deben ser YYYY-MM-DD." };
        }

        let zoneId: string | undefined;
        const zonaQ = strArg(args, "zona").toLowerCase();
        if (zonaQ) {
          const zones = await listCalendarioZones();
          const zone = zones.find((z) => z.name.toLowerCase().includes(zonaQ));
          if (!zone) return { error: `No se encontró la zona «${zonaQ}».`, zonas: zones.map((z) => z.name) };
          zoneId = zone.id;
        }
        let typeId: string | undefined;
        const tipoQ = strArg(args, "tipo").toLowerCase();
        if (tipoQ) {
          const types = await listCalendarioEventTypes();
          const type = types.find((t) => t.name.toLowerCase().includes(tipoQ));
          if (!type) return { error: `No se encontró el tipo «${tipoQ}».`, tipos: types.map((t) => t.name) };
          typeId = type.id;
        }
        let adminUserIds: string[] | undefined;
        const adminQ = strArg(args, "administrador").toLowerCase();
        if (adminQ) {
          if (["yo", "mi", "mis", "mío", "mios", "míos"].includes(adminQ)) {
            adminUserIds = [session.user.id];
          } else {
            const users = await listCalendarioAdminCandidates();
            const matches = users.filter((u) => u.name.toLowerCase().includes(adminQ));
            if (matches.length === 0) return { error: `No se encontró el administrador «${adminQ}».` };
            adminUserIds = matches.map((u) => u.id);
          }
        }
        const estadoMap = { pendiente: "SCHEDULED", realizada: "DONE", cancelada: "CANCELLED" } as const;
        const estadoQ = strArg(args, "estado").toLowerCase() as keyof typeof estadoMap;
        const status = estadoMap[estadoQ];

        const events = await listCalendarioEvents({ from: desde, to: hasta, zoneId, typeId, adminUserIds, status });
        return {
          rango: { desde, hasta },
          total: events.length,
          eventos: events.slice(0, limit).map((e) => ({
            fecha: e.date,
            titulo: e.title,
            tipo: e.type.name,
            periodicidad: CALENDARIO_RECURRENCE_LABELS[e.recurrence],
            estado: CALENDARIO_STATUS_LABELS[e.status],
            zona: e.zone?.name ?? "Varias / todas",
            administradores: e.admins.map((a) => a.name),
            contratos: e.contractsCount,
            completados: e.completedCount,
            evidencias: e.attachmentsCount,
          })),
          fuente: "Alfa One — calendario operativo",
        };
      },
    },
  ];
}
