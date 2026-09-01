import { listDisciplinaryApercibimientos } from "@/modules/disciplinario/services/disciplinary-apercibimientos-list";
import { getDisciplinaryDashboard } from "@/modules/disciplinario/services/disciplinary-dashboard";
import { searchEmployeesForDisciplinary } from "@/modules/disciplinario/services/disciplinary-employee-lookup";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function disciplinarioTools(): SyntraTool[] {
  return [
    {
      permission: { key: "disciplinario.historial", level: "view" },
      definition: toolDef(
        "search_disciplinary_warnings",
        "Busca apercibimientos disciplinarios por empleado, fecha, zona, contrato, cliente o estado.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Nombre o código de empleado (opcional si usa otros filtros)." },
            desde: { type: "string", description: "YYYY-MM-DD" },
            hasta: { type: "string", description: "YYYY-MM-DD" },
            zona: { type: "string" },
            contrato: { type: "string" },
            cliente: { type: "string" },
            estado: { type: "string", enum: ["EMITIDO", "ENTREGADO", "FIRMADO", "ANULADO"] },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Buscando apercibimientos disciplinarios…",
      handler: async (_session, args) => {
        const q = strArg(args, "q");
        const result = await listDisciplinaryApercibimientos({
          desde: parseDate(strArg(args, "desde")),
          hasta: parseDate(strArg(args, "hasta")),
          zona: strArg(args, "zona") || undefined,
          contrato: strArg(args, "contrato") || undefined,
          cliente: strArg(args, "cliente") || undefined,
          estado: strArg(args, "estado") || undefined,
          codigo: /^\d/.test(q) ? q : undefined,
          nombre: q && !/^\d/.test(q) ? q : undefined,
          limit: intArg(args, "limit", 20, 50),
        });
        return { ...result, fuente: "Disciplinario Alfa One" };
      },
    },
    {
      permission: { key: "disciplinario.dashboard", level: "view" },
      definition: toolDef(
        "query_disciplinary_dashboard",
        "Resumen disciplinario: apercibimientos por estado/admin, cobros, bajas y oficiales en 3.er apercibimiento.",
        {
          type: "object",
          properties: {
            desde: { type: "string" },
            hasta: { type: "string" },
            administrador: { type: "string" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando dashboard disciplinario…",
      handler: async (_session, args) => {
        const data = await getDisciplinaryDashboard({
          desde: parseDate(strArg(args, "desde")),
          hasta: parseDate(strArg(args, "hasta")),
          administrador: strArg(args, "administrador") || undefined,
        });
        return { ...data, fuente: "Dashboard disciplinario" };
      },
    },
    {
      permission: { key: "disciplinario.empleados", level: "view" },
      definition: toolDef(
        "search_disciplinary_employees",
        "Busca empleados para contexto disciplinario (directorio local + NAF).",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["q"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => `Buscando empleado «${strArg(args ?? {}, "q").slice(0, 40)}»…`,
      handler: async (_session, args) => {
        const q = strArg(args, "q");
        if (!q) return { error: "Indique texto de búsqueda." };
        const rows = await searchEmployeesForDisciplinary(q, intArg(args, "limit", 10, 25));
        return { empleados: rows, fuente: "Empleados disciplinario" };
      },
    },
  ];
}
