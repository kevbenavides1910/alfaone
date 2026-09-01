import { getTicketsDashboard, searchTickets } from "@/modules/tickets-ti/services/tickets-dashboard";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function ticketsTools(): SyntraTool[] {
  return [
    {
      permission: { key: "ticketsTi.tickets", level: "view" },
      definition: toolDef(
        "search_tickets",
        "Busca tickets de TI por número, título, solicitante o categoría. Respeta la visibilidad del usuario.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Texto a buscar." },
            limit: { type: "integer", description: "Máximo resultados (default 10)." },
          },
          required: ["q"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "q");
        return q ? `Buscando tickets «${q.slice(0, 40)}»…` : "Buscando tickets…";
      },
      handler: async (session, args) => {
        const q = strArg(args, "q");
        if (!q) return { error: "Indique texto de búsqueda." };
        const limit = intArg(args, "limit", 10, 25);
        const rows = await searchTickets(session, session.user.id, q, limit);
        return { tickets: rows, fuente: "Tickets TI Alfa One" };
      },
    },
    {
      permission: { key: "ticketsTi.centro", level: "view" },
      definition: toolDef(
        "query_tickets_dashboard",
        "Resumen del centro de tickets: activos, esperando usuario, SLA vencidos y recientes.",
        { type: "object", properties: {}, additionalProperties: false },
      ),
      describeCall: () => "Consultando centro de tickets…",
      handler: async (session) => {
        const dash = await getTicketsDashboard(session, session.user.id);
        return {
          activos: dash.counts.active,
          esperandoUsuario: dash.counts.waitingUser,
          slaVencidos: dash.counts.overdueSla,
          recientes: dash.tickets.slice(0, 15).map((t) => ({
            numero: t.ticketNumber,
            titulo: t.title,
            estado: t.statusName,
            prioridad: t.priorityCode,
            solicitante: t.requesterName,
          })),
          fuente: "Centro de operaciones Tickets TI",
        };
      },
    },
  ];
}
