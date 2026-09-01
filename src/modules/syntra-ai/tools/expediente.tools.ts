import { searchExpedientePersonas } from "@/modules/expediente-digital/services/oracle-expediente";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function expedienteTools(): SyntraTool[] {
  return [
    {
      permission: { key: "expedienteDigital.list", level: "view" },
      definition: toolDef(
        "search_expediente_person",
        "Busca personas en expediente digital (Oracle NAF) por nombre, cédula o código de empleado.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Nombre, cédula o código." },
            limit: { type: "integer" },
          },
          required: ["q"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "q");
        return q ? `Buscando expediente «${q.slice(0, 40)}»…` : "Buscando en expediente digital…";
      },
      handler: async (_session, args) => {
        const q = strArg(args, "q");
        if (q.length < 2) return { error: "Indique al menos 2 caracteres." };
        const limit = intArg(args, "limit", 15, 25);
        const rows = await searchExpedientePersonas(q, limit);
        return {
          personas: rows.map((p) => ({
            cedula: p.cedula,
            nombre: p.nombre,
            noEmple: p.noEmplePreferido,
            noCia: p.noCiaPreferida,
            estado: p.estado,
            empleos: p.empleosCount,
          })),
          fuente: "Expediente digital (Oracle NAF)",
        };
      },
    },
  ];
}
