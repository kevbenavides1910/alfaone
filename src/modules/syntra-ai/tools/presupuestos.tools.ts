import type { ExpenseType } from "@prisma/client";
import { dbForSession, resolveTenantCompany } from "@/modules/core/db/db-for-session";
import { prisma } from "@/modules/core/db/prisma";
import { autoExpireContracts } from "@/modules/presupuestos/business/autoExpire";
import { getContractProfitability } from "@/modules/presupuestos/business/profitability";
import { buildContractListWhere } from "@/modules/presupuestos/services/contracts-list-where";
import { listExpensesForSession } from "@/modules/presupuestos/services/expenses-list";
import { listOrdenesCompraNaf } from "@/modules/presupuestos/services/list-ordenes-compra-naf";
import { fromMonthString } from "@/lib/utils/format";
import { nowServer } from "@/lib/utils/time";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { MAX_LIST, intArg, strArg } from "./shared";

export function presupuestosTools(): SyntraTool[] {
  return [
    {
      permission: { key: "presupuestos.contracts", level: "view" },
      definition: toolDef(
        "search_contracts",
        "Busca contratos por cliente, licitación o texto libre. NO usar para CK/DAV/BN (canales de pago; use query_revision_planilla_formas_pago).",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Texto a buscar (cliente, licitación, etc.)." },
            limit: { type: "integer", description: "Máximo resultados (default 10)." },
          },
          required: ["q"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "q");
        return q ? `Buscando contratos «${q.slice(0, 48)}»…` : "Buscando contratos…";
      },
      handler: async (session, args) => {
        const q = strArg(args, "q");
        if (!q) return { error: "Indique texto de búsqueda." };
        const limit = intArg(args, "limit", 10, MAX_LIST);
        const sp = new URLSearchParams({ q, pageSize: String(limit) });
        const where = buildContractListWhere(session, sp);
        where.OR = [
          { client: { contains: q, mode: "insensitive" } },
          { licitacionNo: { contains: q, mode: "insensitive" } },
        ];
        const rows = await prisma.contract.findMany({
          where,
          take: limit,
          orderBy: [{ company: "asc" }, { client: "asc" }],
          select: {
            id: true,
            licitacionNo: true,
            client: true,
            company: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        });
        return {
          contratos: rows.map((c) => ({
            id: c.id,
            licitacion: c.licitacionNo,
            cliente: c.client,
            empresa: c.company,
            estado: c.status,
            inicio: c.startDate?.toISOString().slice(0, 10) ?? null,
            fin: c.endDate?.toISOString().slice(0, 10) ?? null,
          })),
          fuente: "Contratos Alfa One",
        };
      },
    },
    {
      permission: { key: "gastos.expenses", level: "view" },
      definition: toolDef(
        "query_expenses_totals",
        "Suma de gastos registrados en Alfa One por tipo y estado de aprobación. Distinto de nómina NAF.",
        {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["PLANILLA", "ADMIN", "FUEL", "PHONES", "UNIFORMS", "OTHER"],
              description: "Tipo de gasto.",
            },
            fDesde: { type: "string", description: "Filtrar periodMonth >= YYYY-MM-DD (opcional)." },
            fHasta: { type: "string", description: "Filtrar periodMonth <= YYYY-MM-DD (opcional)." },
            company: { type: "string", description: "Código de empresa (opcional)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Sumando gastos registrados en Alfa One…",
      handler: async (session, args) => {
        const db = dbForSession(session);
        const where: Record<string, unknown> = { deletedAt: null };
        const company = resolveTenantCompany(session, strArg(args, "company") || null);
        if (company) where.company = company;
        if (typeof args.type === "string" && args.type) where.type = args.type as ExpenseType;
        const fDesde = strArg(args, "fDesde");
        const fHasta = strArg(args, "fHasta");
        if (fDesde || fHasta) {
          const periodMonth: Record<string, Date> = {};
          if (fDesde) periodMonth.gte = new Date(`${fDesde}T00:00:00.000Z`);
          if (fHasta) periodMonth.lte = new Date(`${fHasta}T23:59:59.999Z`);
          where.periodMonth = periodMonth;
        }
        const [agg, byStatus] = await Promise.all([
          db.expense.aggregate({ where, _sum: { amount: true }, _count: { id: true } }),
          db.expense.groupBy({
            by: ["approvalStatus"],
            where,
            _sum: { amount: true },
            _count: { id: true },
          }),
        ]);
        return {
          totalMonto: agg._sum.amount ? parseFloat(agg._sum.amount.toString()) : 0,
          totalRegistros: agg._count.id,
          porEstado: byStatus.map((r) => ({
            estado: r.approvalStatus,
            monto: r._sum.amount ? parseFloat(r._sum.amount.toString()) : 0,
            registros: r._count.id,
          })),
          moneda: "CRC",
          fuente: "Gastos Alfa One (no es nómina NAF)",
        };
      },
    },
    {
      permission: { key: "gastos.expenses", level: "view" },
      definition: toolDef(
        "search_ordenes_compra_codisa",
        "Busca órdenes de compra reales en Codisa/NAF (ARIMENCORDEN) por número, proveedor u observación. Útil al registrar gastos con N° OC.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Texto: número OC, proveedor u observación." },
            company: { type: "string", description: "Código de empresa Alfa One (opcional)." },
            limit: { type: "integer", description: "Máximo resultados (default 15)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "q");
        return q ? `Buscando OC Codisa «${q.slice(0, 40)}»…` : "Listando OC Codisa…";
      },
      handler: async (session, args) => {
        const company =
          resolveTenantCompany(session, strArg(args, "company") || null) ?? undefined;
        const limit = intArg(args, "limit", 15, MAX_LIST);
        const result = await listOrdenesCompraNaf({
          search: strArg(args, "q") || undefined,
          company,
          limit,
        });
        return {
          total: result.rows.length,
          ordenes: result.rows.map((r) => ({
            noOrden: r.noOrden,
            noCia: r.noCia,
            empresa: r.companyCode,
            proveedor: r.proveedor,
            fecha: r.fecha,
            estado: r.estado,
            observaciones: r.observaciones,
          })),
          fetchedAt: result.fetchedAt,
          fuente: "Codisa NAF5.ARIMENCORDEN",
        };
      },
    },
    {
      permission: { key: "gastos.expenses", level: "view" },
      definition: toolDef(
        "list_expenses",
        "Lista gastos individuales en Alfa One con contrato, tipo, monto y estado de aprobación.",
        {
          type: "object",
          properties: {
            contractId: { type: "string", description: "ID de contrato (opcional)." },
            type: {
              type: "string",
              enum: ["PLANILLA", "ADMIN", "FUEL", "PHONES", "UNIFORMS", "OTHER"],
            },
            approvalStatus: {
              type: "string",
              enum: ["PENDING", "PENDING_APPROVAL", "PARTIALLY_APPROVED", "APPROVED", "REJECTED"],
              description: "PENDING incluye pendientes y parcialmente aprobados.",
            },
            company: { type: "string" },
            limit: { type: "integer", description: "Máximo filas (default 15)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Listando gastos en Alfa One…",
      handler: async (session, args) => {
        const limit = intArg(args, "limit", 15, MAX_LIST);
        const result = await listExpensesForSession(session, {
          pageSize: limit,
          contractId: strArg(args, "contractId") || null,
          company: strArg(args, "company") || null,
          type: (typeof args.type === "string" ? args.type : null) as ExpenseType | null,
          approvalStatus:
            typeof args.approvalStatus === "string"
              ? (args.approvalStatus as "PENDING" | "PENDING_APPROVAL" | "PARTIALLY_APPROVED" | "APPROVED" | "REJECTED")
              : null,
        });
        return {
          gastos: result.data.map((e) => ({
            id: e.id,
            tipo: e.type,
            monto: e.amount,
            estado: e.approvalStatus,
            periodo: e.periodMonth?.toISOString().slice(0, 10) ?? null,
            contrato: e.contract
              ? { licitacion: e.contract.licitacionNo, cliente: e.contract.client }
              : null,
            descripcion: e.description,
          })),
          total: result.meta.total,
          moneda: "CRC",
          fuente: "Gastos Alfa One",
        };
      },
    },
    {
      permission: { key: "presupuestos.contracts", level: "view" },
      definition: toolDef(
        "query_contract_profitability",
        "Rentabilidad/semáforo de un contrato en un mes (gastos vs presupuesto). Requiere contractId (obténgalo con search_contracts).",
        {
          type: "object",
          properties: {
            contractId: { type: "string", description: "UUID del contrato." },
            month: { type: "string", description: "Mes YYYY-MM (default: mes actual)." },
          },
          required: ["contractId"],
          additionalProperties: false,
        },
      ),
      describeCall: () => "Calculando rentabilidad del contrato…",
      handler: async (_session, args) => {
        const contractId = strArg(args, "contractId");
        if (!contractId) return { error: "Indique contractId." };
        const now = nowServer();
        const defaultMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodMonth = strArg(args, "month") ? fromMonthString(strArg(args, "month")) : defaultMonth;
        const prof = await getContractProfitability(contractId, periodMonth);
        return {
          contractId: prof.contractId,
          mes: periodMonth.toISOString().slice(0, 7),
          semaforo: prof.trafficLight,
          facturacionMensual: prof.monthlyBilling,
          gastoTotal: prof.grandTotal,
          presupuestoInsumos: prof.suppliesBudget,
          pctEjecucion: prof.budgetUsagePctFormatted,
          fuente: "Rentabilidad Alfa One",
        };
      },
    },
    {
      permission: { key: "core.dashboard_ejecutivo", level: "view" },
      definition: toolDef(
        "query_traffic_light_summary",
        "Resumen del semáforo de rentabilidad: cuántos contratos en verde, amarillo y rojo este mes.",
        {
          type: "object",
          properties: {
            month: { type: "string", description: "Mes YYYY-MM (default: mes actual)." },
            company: { type: "string", description: "Filtrar por empresa (opcional)." },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando semáforo de contratos…",
      handler: async (session, args) => {
        await autoExpireContracts();
        const where: Record<string, unknown> = {
          status: { notIn: ["CANCELLED", "FINISHED"] },
          deletedAt: null,
        };
        if (session.user.company) where.company = session.user.company;
        else if (strArg(args, "company")) where.company = strArg(args, "company");

        const contracts = await prisma.contract.findMany({
          where,
          orderBy: [{ company: "asc" }, { client: "asc" }],
        });
        const now = nowServer();
        const defaultMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodMonth = strArg(args, "month") ? fromMonthString(strArg(args, "month")) : defaultMonth;

        const results = await Promise.all(
          contracts.map(async (c) => {
            const prof = await getContractProfitability(c.id, periodMonth);
            return {
              contractId: c.id,
              licitacion: c.licitacionNo,
              cliente: c.client,
              empresa: c.company,
              semaforo: prof.trafficLight,
              gastoTotal: prof.grandTotal,
              presupuesto: prof.suppliesBudget,
            };
          }),
        );

        return {
          mes: periodMonth.toISOString().slice(0, 7),
          resumen: {
            total: results.length,
            verde: results.filter((r) => r.semaforo === "GREEN").length,
            amarillo: results.filter((r) => r.semaforo === "YELLOW").length,
            rojo: results.filter((r) => r.semaforo === "RED").length,
          },
          contratos: results.slice(0, MAX_LIST),
          fuente: "Semáforo Alfa One",
        };
      },
    },
  ];
}
