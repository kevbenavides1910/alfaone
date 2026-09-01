import { listCxpFacturas } from "@/modules/cuentas-por-pagar/services/list-cxp-facturas";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { MAX_LIST, currentYearMonth, intArg, strArg } from "./shared";

export function cxpTools(): SyntraTool[] {
  return [
    {
      permission: { key: "cuentasPorPagar.facturas", level: "view" },
      definition: toolDef(
        "search_cxp_facturas",
        "Busca facturas de cuentas por pagar (CXP) en NAF: proveedor, saldo, estado de pago y vínculo FAE.",
        {
          type: "object",
          properties: {
            search: { type: "string", description: "Proveedor, número de documento o texto libre." },
            periodYear: { type: "integer", description: "Año (default: actual)." },
            periodMonth: {
              type: "integer",
              description: "Mes 1-12; 0 = todo el año (default: mes actual).",
            },
            company: { type: "string", description: "Código de empresa Alfa One." },
            estados: {
              type: "array",
              items: { type: "string", enum: ["PENDIENTE", "PARCIAL", "PAGADA", "ANULADA", "SIN_CXP"] },
              description: "Filtrar por estado (vacío = todos).",
            },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "search");
        return q ? `Buscando facturas CXP «${q.slice(0, 40)}»…` : "Consultando cuentas por pagar…";
      },
      handler: async (_session, args) => {
        const { year, month: currentMonth } = currentYearMonth();
        const periodYear = intArg(args, "periodYear", year);
        const periodMonth = intArg(args, "periodMonth", Number(currentMonth.split("-")[1]));
        const pageSize = intArg(args, "limit", 20, MAX_LIST);
        const estados = Array.isArray(args.estados) ? (args.estados as string[]) : [];

        const result = await listCxpFacturas({
          periodYear,
          periodMonth,
          company: strArg(args, "company") || undefined,
          search: strArg(args, "search") || undefined,
          estados: estados as ("PENDIENTE" | "PARCIAL" | "PAGADA" | "ANULADA" | "SIN_CXP")[],
          faeLink: "ALL",
          page: 1,
          pageSize,
        });

        return {
          periodo: { year: periodYear, month: periodMonth },
          resumen: result.summary,
          facturas: result.rows.slice(0, pageSize).map((r) => ({
            proveedor: r.proveedor,
            noDocu: r.noDocu,
            fecha: r.fecha,
            monto: r.monto,
            saldo: r.saldo,
            estado: r.estado,
            moneda: r.monedaLabel,
            conFae: r.conFae,
          })),
          total: result.total,
          fuente: "CXP NAF (Oracle)",
        };
      },
    },
  ];
}
