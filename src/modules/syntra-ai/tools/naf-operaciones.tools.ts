import { listOpAsistencia } from "@/modules/naf-operaciones/services/list-asistencia-rol";
import { listOpRoles } from "@/modules/naf-operaciones/services/list-roles";
import { listOpVacantes } from "@/modules/naf-operaciones/services/list-vacantes";
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
  ];
}
