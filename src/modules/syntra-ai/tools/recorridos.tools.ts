import { getPatrolMarksComplianceReport } from "@/modules/syntra/services/patrol-marks-compliance-service";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function recorridosTools(): SyntraTool[] {
  return [
    {
      permission: { key: "recorridos.reportes", level: "view" },
      definition: toolDef(
        "query_patrol_compliance",
        "Cumplimiento de marcas NFC en recorridos: esperadas vs realizadas/justificadas por rango de fechas.",
        {
          type: "object",
          properties: {
            fDesde: { type: "string", description: "YYYY-MM-DD" },
            fHasta: { type: "string", description: "YYYY-MM-DD" },
            imei: { type: "string" },
            routeId: { type: "string" },
          },
          required: ["fDesde", "fHasta"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const d = strArg(args ?? {}, "fDesde");
        const h = strArg(args ?? {}, "fHasta");
        return d && h ? `Consultando cumplimiento de marcas (${d} – ${h})…` : "Consultando recorridos…";
      },
      handler: async (_session, args) => {
        const fDesde = strArg(args, "fDesde");
        const fHasta = strArg(args, "fHasta");
        if (!fDesde || !fHasta) return { error: "Indique fDesde y fHasta." };
        const result = await getPatrolMarksComplianceReport({
          desde: fDesde,
          hasta: fHasta,
          imei: strArg(args, "imei") || undefined,
          routeId: strArg(args, "routeId") || undefined,
        });
        const limit = intArg(args, "limit", 25, 50);
        return {
          periodo: result.periodo,
          totales: result.totales,
          filas: result.filas.slice(0, limit),
          fuente: "Recorridos — cumplimiento de marcas",
        };
      },
    },
  ];
}
