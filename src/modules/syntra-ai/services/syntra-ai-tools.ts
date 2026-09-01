import type { Session } from "next-auth";
import type { ExpenseType } from "@prisma/client";
import { hasPermission } from "@/lib/permissions/check";
import { dbForSession, resolveTenantCompany } from "@/modules/core/db/db-for-session";
import {
  getNafNominaByDateRange,
  listNafNominaEmpresas,
  listNafNominaPeriodos,
} from "@/modules/empleados-naf/services/list-nomina";
import { buildContractListWhere } from "@/modules/presupuestos/services/contracts-list-where";
import { prisma } from "@/modules/core/db/prisma";

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const MAX_LIST = 25;

function isoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

async function resolveNoCias(session: Session, noCias?: string[]): Promise<string[]> {
  const empresas = await listNafNominaEmpresas();
  const allowed = new Set(empresas.map((e) => e.noCia));
  if (noCias?.length) {
    return noCias.filter((n) => allowed.has(n.trim())).slice(0, 10);
  }
  const company = session.user.company;
  if (company) {
    return empresas.filter((e) => e.companyCode === company).map((e) => e.noCia);
  }
  return empresas.map((e) => e.noCia);
}

export function getSyntraToolDefinitions(session: Session): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  if (hasPermission(session, "empleadosNaf.nomina", "view")) {
    tools.push(
      {
        type: "function",
        function: {
          name: "list_payroll_companies",
          description:
            "Lista empresas NAF con datos de nómina sincronizados (noCia, código y nombre). Use antes de consultar planilla si no conoce el noCia.",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      {
        type: "function",
        function: {
          name: "list_payroll_periods",
          description:
            "Lista quincenas/periodos de nómina NAF disponibles (más recientes primero). Devuelve fDesde, fHasta y etiqueta. Use para resolver «última quincena».",
          parameters: {
            type: "object",
            properties: {
              noCias: {
                type: "array",
                items: { type: "string" },
                description: "Códigos NAF de empresa (ej. 01). Vacío = empresas del usuario.",
              },
              limit: { type: "integer", description: "Máximo de periodos (default 6)." },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "query_payroll_totals",
          description:
            "Totales de planilla/nómina NAF (devengado, deducciones, neto, empleados) en un rango de fechas. NAF es la fuente de verdad para planilla.",
          parameters: {
            type: "object",
            properties: {
              fDesde: { type: "string", description: "Fecha inicio YYYY-MM-DD." },
              fHasta: { type: "string", description: "Fecha fin YYYY-MM-DD." },
              noCias: {
                type: "array",
                items: { type: "string" },
                description: "Empresas NAF. Vacío = empresas del usuario.",
              },
            },
            required: ["fDesde", "fHasta"],
            additionalProperties: false,
          },
        },
      },
    );
  }

  if (hasPermission(session, "presupuestos.expenses", "view")) {
    tools.push({
      type: "function",
      function: {
        name: "query_expenses_totals",
        description:
          "Suma de gastos registrados en Alfa One por tipo y estado de aprobación. Distinto de nómina NAF (use query_payroll_totals para planilla Oracle).",
        parameters: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["PLANILLA", "ADMIN", "FUEL", "PHONES", "UNIFORMS", "OTHER"],
              description: "Tipo de gasto. PLANILLA = gastos administrativos de planilla en el módulo Gastos.",
            },
            fDesde: { type: "string", description: "Filtrar periodMonth >= YYYY-MM-DD (opcional)." },
            fHasta: { type: "string", description: "Filtrar periodMonth <= YYYY-MM-DD (opcional)." },
            company: { type: "string", description: "Código de empresa (opcional)." },
          },
          additionalProperties: false,
        },
      },
    });
  }

  if (hasPermission(session, "presupuestos.contracts", "view")) {
    tools.push({
      type: "function",
      function: {
        name: "search_contracts",
        description: "Busca contratos por cliente, licitación o texto libre.",
        parameters: {
          type: "object",
          properties: {
            q: { type: "string", description: "Texto a buscar (cliente, licitación, etc.)." },
            limit: { type: "integer", description: "Máximo resultados (default 10)." },
          },
          required: ["q"],
          additionalProperties: false,
        },
      },
    });
  }

  return tools;
}

export async function executeSyntraTool(
  session: Session,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    switch (name) {
      case "list_payroll_companies":
        return await toolListPayrollCompanies(session);
      case "list_payroll_periods":
        return await toolListPayrollPeriods(session, args);
      case "query_payroll_totals":
        return await toolQueryPayrollTotals(session, args);
      case "query_expenses_totals":
        return await toolQueryExpensesTotals(session, args);
      case "search_contracts":
        return await toolSearchContracts(session, args);
      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al ejecutar herramienta" };
  }
}

async function toolListPayrollCompanies(session: Session) {
  if (!hasPermission(session, "empleadosNaf.nomina", "view")) {
    return { error: "Sin permiso para ver nómina NAF." };
  }
  const empresas = await listNafNominaEmpresas();
  const company = session.user.company;
  const filtered = company ? empresas.filter((e) => e.companyCode === company) : empresas;
  return {
    empresas: filtered.slice(0, MAX_LIST).map((e) => ({
      noCia: e.noCia,
      companyCode: e.companyCode,
      label: e.companyLabel,
    })),
    nota: "NAF es la fuente de verdad para planilla. Use noCia en otras herramientas.",
  };
}

async function toolListPayrollPeriods(session: Session, args: Record<string, unknown>) {
  if (!hasPermission(session, "empleadosNaf.nomina", "view")) {
    return { error: "Sin permiso para ver nómina NAF." };
  }
  const noCias = await resolveNoCias(session, Array.isArray(args.noCias) ? (args.noCias as string[]) : undefined);
  if (!noCias.length) return { error: "No hay empresas NAF con nómina sincronizada." };
  const limit = typeof args.limit === "number" ? Math.min(args.limit, 12) : 6;
  const periodos = await listNafNominaPeriodos(noCias);
  return {
    periodos: periodos.slice(0, limit).map((p) => ({
      label: p.label,
      fDesde: isoDate(p.fDesde),
      fHasta: isoDate(p.fHasta),
      ano: p.ano,
      descri: p.descri,
      empresas: p.empresas,
    })),
    noCias,
  };
}

async function toolQueryPayrollTotals(session: Session, args: Record<string, unknown>) {
  if (!hasPermission(session, "empleadosNaf.nomina", "view")) {
    return { error: "Sin permiso para ver nómina NAF." };
  }
  const fDesde = typeof args.fDesde === "string" ? args.fDesde.trim() : "";
  const fHasta = typeof args.fHasta === "string" ? args.fHasta.trim() : "";
  if (!fDesde || !fHasta) return { error: "Indique fDesde y fHasta (YYYY-MM-DD)." };

  const noCias = await resolveNoCias(session, Array.isArray(args.noCias) ? (args.noCias as string[]) : undefined);
  if (!noCias.length) return { error: "No hay empresas NAF disponibles." };

  const detalle = await getNafNominaByDateRange(fDesde, fHasta, noCias, undefined, {
    laborAllocationOnly: true,
  });

  return {
    periodo: { fDesde: isoDate(detalle.fDesde), fHasta: isoDate(detalle.fHasta), descri: detalle.meta.descri },
    totales: detalle.totales,
    porEmpresa: detalle.porEmpresa.slice(0, MAX_LIST).map((e) => ({
      noCia: e.noCia,
      empresa: e.companyLabel,
      empleados: e.empleados,
      devengado: e.devengado,
      deducciones: e.deducciones,
      neto: e.neto,
    })),
    moneda: "CRC",
    fuente: "NAF (nómina sincronizada)",
  };
}

async function toolQueryExpensesTotals(session: Session, args: Record<string, unknown>) {
  if (!hasPermission(session, "presupuestos.expenses", "view")) {
    return { error: "Sin permiso para ver gastos." };
  }
  const db = dbForSession(session);
  const where: Record<string, unknown> = { deletedAt: null };
  const company = resolveTenantCompany(session, typeof args.company === "string" ? args.company : null);
  if (company) where.company = company;
  if (typeof args.type === "string" && args.type) where.type = args.type as ExpenseType;

  const fDesde = typeof args.fDesde === "string" ? args.fDesde.trim() : "";
  const fHasta = typeof args.fHasta === "string" ? args.fHasta.trim() : "";
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
    filtros: { type: args.type ?? null, fDesde: fDesde || null, fHasta: fHasta || null, company: company ?? null },
  };
}

async function toolSearchContracts(session: Session, args: Record<string, unknown>) {
  if (!hasPermission(session, "presupuestos.contracts", "view")) {
    return { error: "Sin permiso para ver contratos." };
  }
  const q = typeof args.q === "string" ? args.q.trim() : "";
  if (!q) return { error: "Indique texto de búsqueda." };
  const limit = typeof args.limit === "number" ? Math.min(args.limit, MAX_LIST) : 10;

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
  };
}

function describeToolCall(toolName: string, args?: Record<string, unknown>): string {
  switch (toolName) {
    case "list_payroll_companies":
      return "Listando empresas con nómina NAF…";
    case "list_payroll_periods":
      return "Buscando quincenas de planilla disponibles…";
    case "query_payroll_totals": {
      const desde = typeof args?.fDesde === "string" ? args.fDesde.slice(0, 10) : "";
      const hasta = typeof args?.fHasta === "string" ? args.fHasta.slice(0, 10) : "";
      if (desde && hasta) return `Calculando totales de planilla (${desde} – ${hasta})…`;
      return "Calculando totales de nómina NAF…";
    }
    case "query_expenses_totals":
      return "Sumando gastos registrados en Alfa One…";
    case "search_contracts": {
      const q = typeof args?.q === "string" ? args.q.trim() : "";
      if (q) return `Buscando contratos «${q.slice(0, 48)}»…`;
      return "Buscando contratos…";
    }
    default:
      return `Consultando ${toolName.replace(/_/g, " ")}…`;
  }
}

export function describeAgentProgress(
  kind: "start" | "llm" | "tool" | "compose" | "model",
  detail?: { round?: number; toolName?: string; args?: Record<string, unknown> },
): string {
  switch (kind) {
    case "start":
      return "Recibiendo su pregunta…";
    case "llm":
      return detail?.round === 0 ? "Analizando su pregunta…" : "Interpretando los datos obtenidos…";
    case "tool":
      return describeToolCall(detail?.toolName || "", detail?.args);
    case "compose":
      return "Redactando respuesta…";
    case "model":
      return "Generando respuesta con el modelo…";
    default:
      return "Procesando…";
  }
}

export const AGENT_TOOLS_PROMPT = `## Consulta de datos reales
Tienes herramientas para consultar nómina NAF, gastos y contratos con los permisos del usuario.
- Para «cuánto se gastó de planilla / nómina / quincena»: use list_payroll_periods (última quincena) y luego query_payroll_totals.
- NAF (query_payroll_totals) es la fuente de verdad para planilla; los gastos tipo PLANILLA en Alfa One son registros administrativos distintos.
- Presente montos en colones (₡) con separadores de miles. Cite el periodo exacto (fDesde–fHasta).
- Si una herramienta devuelve error de permiso, explíquelo y sugiera la pantalla correspondiente.`;
