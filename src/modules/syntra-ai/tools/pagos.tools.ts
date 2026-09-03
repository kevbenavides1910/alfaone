import { getCalendarMonth, searchPaymentsByOc } from "@/modules/pagos/services/pagos";
import { listPagoProveedores } from "@/modules/pagos/services/pago-proveedores";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { currentYearMonth, strArg } from "./shared";

const MAX_LIST = 40;

export function pagosTools(): SyntraTool[] {
  return [
    {
      permission: { key: "pagos.calendario", level: "view" },
      definition: toolDef(
        "query_payment_calendar",
        "Calendario de pagos del mes: pagos APEX, manuales y gastos ya programados (con fecha asignada en Pago proveedores), con totales pagado/pendiente por día.",
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
    {
      permission: { key: "pagos.calendario", level: "view" },
      definition: toolDef(
        "search_payments_by_oc",
        "Busca pagos por número de OC (orden de compra / referencia) en todos los meses del calendario.",
        {
          type: "object",
          properties: {
            oc: {
              type: "string",
              description: "Número o fragmento de OC / referencia (mín. 2 caracteres).",
            },
            company: { type: "string", description: "Filtrar por empresa (opcional)." },
          },
          required: ["oc"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const oc = strArg(args ?? {}, "oc") || "…";
        return `Buscando pagos con OC «${oc}»…`;
      },
      handler: async (_session, args) => {
        const oc = strArg(args, "oc");
        if (!oc || oc.length < 2) {
          return { error: "Indicá al menos 2 caracteres del número de OC." };
        }
        const company = strArg(args, "company") || undefined;
        const rows = await searchPaymentsByOc(oc, company);
        return {
          oc,
          total: rows.length,
          pagos: rows.slice(0, MAX_LIST).map((p) => ({
            id: p.id,
            fecha: p.paymentDate,
            oc: p.referenceNumber,
            descripcion: p.description,
            monto: p.amount,
            compania: p.company,
            fuente: p.source,
            pagado: p.paid,
          })),
          moneda: "CRC",
          fuente: "Calendario de pagos Alfa One (búsqueda por OC)",
        };
      },
    },
    {
      permission: { key: "pagos.calendario", level: "view" },
      definition: toolDef(
        "list_pago_proveedores",
        "Lista gastos aprobados pendientes: sin programar en calendario o ya programados pero no pagados. Pestaña Pago proveedores.",
        {
          type: "object",
          properties: {
            company: { type: "string", description: "Filtrar por empresa (opcional)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Listando gastos pendientes (pago proveedores)…",
      handler: async (_session, args) => {
        const company = strArg(args, "company") || undefined;
        const rows = await listPagoProveedores(company);
        return {
          total: rows.length,
          gastos: rows.slice(0, MAX_LIST).map((e) => ({
            id: e.id,
            descripcion: e.description,
            monto: e.amount,
            oc: e.referenceNumber,
            tipo: e.type,
            compania: e.company,
            periodo: e.periodMonth,
            estado: e.status === "unscheduled" ? "sin_programar" : "en_calendario_impago",
            fechaPago: e.paymentDate,
            rebanadasPresupuesto: e.budgetSlices,
          })),
          moneda: "CRC",
          fuente: "Pagos → Pago proveedores",
        };
      },
    },
  ];
}
