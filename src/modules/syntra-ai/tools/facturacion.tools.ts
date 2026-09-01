import { prisma } from "@/modules/core/db/prisma";
import { dbForSession } from "@/modules/core/db/db-for-session";
import {
  cxcDocumentInclude,
  cxcListWhere,
  serializeCuentaPorCobrar,
} from "@/modules/presupuestos/services/cuentas-por-cobrar";
import { buildFacturacionDashboard } from "@/modules/presupuestos/services/facturacion-dashboard";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { MAX_LIST, currentYearMonth, intArg, strArg } from "./shared";

export function facturacionTools(): SyntraTool[] {
  return [
    {
      permission: { key: "facturacion.dashboard", level: "view" },
      definition: toolDef(
        "query_facturacion_dashboard",
        "KPIs de facturación y cuentas por cobrar por mes del año (facturado, cobrado, pendiente).",
        {
          type: "object",
          properties: {
            year: { type: "integer", description: "Año (default: año actual)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando dashboard de facturación…",
      handler: async (session, args) => {
        const db = dbForSession(session);
        const year = intArg(args, "year", currentYearMonth().year, 2100);
        const dash = await buildFacturacionDashboard(db, year);
        return {
          year,
          meses: dash.months.map((m) => ({
            mes: m.month,
            label: m.label,
            cxcPendiente: m.cxc.pendingAmount,
            cxcCobrado: m.cxc.collectedOnTimeAmount + m.cxc.collectedLateAmount,
            facturado: m.facturacion.invoicedAmount,
            ingresosEsperados: m.ingresos.expectedInflowAmount,
            ingresosReales: m.ingresos.actualInflowAmount,
          })),
          totales: dash.totals,
          fuente: "Facturación y cobro Alfa One",
          moneda: "CRC",
        };
      },
    },
    {
      permission: { key: "facturacion.cxc", level: "view" },
      definition: toolDef(
        "search_cxc",
        "Busca cuentas por cobrar (facturas pendientes, cobradas o todas) por cliente, licitación o filtros.",
        {
          type: "object",
          properties: {
            filter: {
              type: "string",
              enum: ["pending", "collected", "all"],
              description: "Default: pending.",
            },
            client: { type: "string", description: "Filtrar por nombre de cliente." },
            licitacion: { type: "string", description: "Filtrar por número de licitación." },
            company: { type: "string" },
            limit: { type: "integer", description: "Máximo documentos (default 20)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const client = strArg(args ?? {}, "client");
        if (client) return `Buscando CxC de «${client.slice(0, 40)}»…`;
        return "Consultando cuentas por cobrar…";
      },
      handler: async (_session, args) => {
        const filter = (strArg(args, "filter") || "pending") as "pending" | "collected" | "all";
        const input = {
          filter,
          client: strArg(args, "client") || undefined,
          licitacion: strArg(args, "licitacion") || undefined,
          company: strArg(args, "company") || undefined,
        };
        const limit = intArg(args, "limit", 20, MAX_LIST);
        const rows = await prisma.cxcDocumento.findMany({
          where: cxcListWhere(input),
          orderBy: [{ dueDate: "asc" }, { clientName: "asc" }],
          include: cxcDocumentInclude,
          take: limit,
        });
        const docs = rows.map(serializeCuentaPorCobrar);
        const totalSaldo = docs.reduce((s, d) => s + (d.remainingBalance ?? 0), 0);
        return {
          documentos: docs.slice(0, limit).map((d) => ({
            id: d.id,
            cliente: d.clientNameCopied,
            licitacion: d.licitacionNo,
            tipo: d.docType,
            estado: d.status,
            vencimiento: d.dueDate,
            saldo: d.remainingBalance,
            total: d.totalCalculated,
          })),
          totalDocumentos: docs.length,
          saldoTotal: totalSaldo,
          moneda: "CRC",
          fuente: "Cuentas por cobrar Alfa One",
        };
      },
    },
  ];
}
