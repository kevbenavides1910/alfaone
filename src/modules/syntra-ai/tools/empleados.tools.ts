import { listEmployees } from "@/modules/empleados/services/employees-list";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function empleadosTools(): SyntraTool[] {
  return [
    {
      permission: { key: "empleados.list", level: "view" },
      definition: toolDef(
        "search_employees",
        "Busca empleados en el directorio Alfa One (no NAF) por nombre, cédula o código.",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            zona: { type: "string" },
            contrato: { type: "string" },
            estado: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "q");
        return q ? `Buscando empleados «${q.slice(0, 40)}»…` : "Buscando empleados…";
      },
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 15, 25);
        const result = await listEmployees({
          q: strArg(args, "q") || undefined,
          zona: strArg(args, "zona") || undefined,
          contrato: strArg(args, "contrato") || undefined,
          estado: strArg(args, "estado") || undefined,
          pageSize: limit,
        });
        return {
          empleados: result.rows.map((e) => ({
            codigo: e.codigoEmpleado,
            nombre: e.nombre,
            cedula: e.cedula,
            estado: e.estado,
            zona: e.zona,
            contrato: e.primaryPlacement?.contrato ?? e.primaryPlacement?.contract?.licitacionNo ?? null,
          })),
          total: result.total,
          fuente: "Directorio empleados Alfa One",
        };
      },
    },
  ];
}
