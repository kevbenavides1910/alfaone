import { listActivaciones } from "@/modules/monitoreo/services/activaciones";
import { consultarCodigoAlarma } from "@/modules/monitoreo/services/consulta";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function monitoreoTools(): SyntraTool[] {
  return [
    {
      permission: { key: "monitoreo.registros", level: "view" },
      definition: toolDef(
        "list_monitoreo_activaciones",
        "Activaciones de alarma registradas en monitoreo por rango de fechas.",
        {
          type: "object",
          properties: {
            fDesde: { type: "string" },
            fHasta: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando activaciones de monitoreo…",
      handler: async (_session, args) => {
        const rows = await listActivaciones({
          limit: intArg(args, "limit", 25, 50),
          desde: parseDate(strArg(args, "fDesde")) ?? undefined,
          hasta: parseDate(strArg(args, "fHasta")) ?? undefined,
        });
        return {
          activaciones: rows.map((a) => ({
            finca: a.finca,
            alarmNumber: a.alarmNumber,
            activatedAt: a.activatedAt.toISOString(),
            operador: a.operadorName,
            estado: a.estado,
          })),
          total: rows.length,
          fuente: "Monitoreo — activaciones",
        };
      },
    },
    {
      permission: { key: "monitoreo.consulta", level: "view" },
      definition: toolDef(
        "lookup_monitoreo_alarm",
        "Consulta detalle de un código de alarma en el catálogo de monitoreo.",
        {
          type: "object",
          properties: {
            alarmNumber: { type: "integer", description: "Número de alarma." },
          },
          required: ["alarmNumber"],
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando código de alarma…",
      handler: async (_session, args) => {
        const n = typeof args.alarmNumber === "number" ? args.alarmNumber : Number(strArg(args, "alarmNumber"));
        if (!n || Number.isNaN(n)) return { error: "Indique alarmNumber." };
        const result = await consultarCodigoAlarma(n);
        return { alarma: result, fuente: "Monitoreo — consulta" };
      },
    },
  ];
}
