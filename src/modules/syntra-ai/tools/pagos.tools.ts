import { getCalendarMonth } from "@/modules/pagos/services/pagos";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { currentYearMonth, strArg } from "./shared";

export function pagosTools(): SyntraTool[] {
  return [
    {
      permission: { key: "pagos.calendario", level: "view" },
      definition: toolDef(
        "query_payment_calendar",
        "Calendario de pagos del mes: gastos aprobados, pagos APEX y manuales, con totales pagado/pendiente por día.",
        {
          type: "object",
          properties: {
            month: { type: "string", description: "Mes YYYY-MM (default: mes actual)." },
            company: { type: "string", description: "Filtrar por empresa (opcional)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const month = strArg(args ?? {}, "month") || currentYearMonth().month;
        return `Consultando calendario de pagos (${month})…`;
      },
      handler: async (_session, args) => {
        const month = strArg(args, "month") || currentYearMonth().month;
        const company = strArg(args, "company") || undefined;
        const days = await getCalendarMonth(month, company);
        const withPayments = days.filter((d) => d.payments.length > 0);
        const totalMes = withPayments.reduce((s, d) => s + d.total, 0);
        const totalPagado = withPayments.reduce((s, d) => s + d.totalPaid, 0);
        return {
          month,
          resumen: {
            diasConPagos: withPayments.length,
            totalMes,
            totalPagado,
            pendiente: totalMes - totalPagado,
          },
          dias: withPayments.slice(0, 31).map((d) => ({
            fecha: d.date,
            pagos: d.payments.length,
            total: d.total,
            pagado: d.totalPaid,
          })),
          moneda: "CRC",
          fuente: "Calendario de pagos Alfa One",
        };
      },
    },
  ];
}
