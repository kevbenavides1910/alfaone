import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, serverError } from "@/lib/api/response";
import { mergeLegacyForReportPartida } from "@/modules/presupuestos/business/profitability";
import { getProfitabilityForContracts } from "@/modules/presupuestos/business/profitability-batch";
import { getNafLaborCostByContractForMonth } from "@/modules/empleados-naf/services/naf-labor-report";
import { parseReportPartida, type ReportPartidaFilter } from "@/lib/utils/constants";
import { fromMonthString } from "@/lib/utils/format";
import { ContractStatus } from "@prisma/client";
import {
  buildProfitabilityReportCacheKey,
  getProfitabilityReportCache,
  setProfitabilityReportCache,
} from "@/modules/presupuestos/services/profitability-report-cache";

const DEFERRED_LEGACY_TYPE = "DEFERRED_LEGACY" as const;

const FALLBACK_EXPENSE_COLUMNS: { type: string; label: string; sortOrder: number }[] = [
  { type: "APERTURA", label: "Apertura", sortOrder: 1 },
  { type: "UNIFORMS", label: "Uniformes", sortOrder: 2 },
  { type: "AUDIT", label: "Auditoría", sortOrder: 3 },
  { type: "ADMIN", label: "Administrativo", sortOrder: 4 },
  { type: "TRANSPORT", label: "Transporte", sortOrder: 5 },
  { type: "FUEL", label: "Combustible", sortOrder: 6 },
  { type: "PHONES", label: "Teléfonos", sortOrder: 7 },
  { type: "PLANILLA", label: "Planilla", sortOrder: 8 },
  { type: "OTHER", label: "Otros", sortOrder: 9 },
];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const companyValues = searchParams.getAll("company").map((c) => c.trim()).filter(Boolean);
  const month = searchParams.get("month");
  const partida: ReportPartidaFilter = parseReportPartida(searchParams.get("partida"));

  const periodMonth = month ? fromMonthString(month) : undefined;

  const where: Record<string, unknown> = {
    deletedAt: null,
    /** Solo operación vigente: activo o prórroga (excluye finalizados, suspendidos, cancelados). */
    status: { in: [ContractStatus.ACTIVE, ContractStatus.PROLONGATION] },
  };
  if (session.user.company) {
    where.company = session.user.company;
  } else if (companyValues.length === 1) {
    where.company = companyValues[0];
  } else if (companyValues.length > 1) {
    where.company = { in: companyValues };
  }

  if (periodMonth) {
    const y = periodMonth.getFullYear();
    const mo = periodMonth.getMonth();
    const monthStart = new Date(y, mo, 1);
    const monthEnd = new Date(y, mo + 1, 0);
    where.startDate = { lte: monthEnd };
    where.endDate = { gte: monthStart };
  }

  const cacheKey = buildProfitabilityReportCacheKey({
    month: month ?? null,
    companies: companyValues,
    partida,
    userCompany: session.user.company ?? null,
  });
  const cached = getProfitabilityReportCache<{
    rows: unknown[];
    totals: unknown;
    expenseTypeColumns: unknown[];
  }>(cacheKey);
  if (cached) {
    return ok(cached);
  }

  try {
    const contracts = await prisma.contract.findMany({
      where,
      orderBy: [{ company: "asc" }, { client: "asc" }],
    });

    const typeConfigs = await prisma.expenseTypeConfig.findMany({
      orderBy: { sortOrder: "asc" },
    });

    let baseColumns =
      typeConfigs.length > 0
        ? typeConfigs
            .filter((c) => c.isActive)
            .map((c) => ({ type: c.type, label: c.label, sortOrder: c.sortOrder }))
        : FALLBACK_EXPENSE_COLUMNS;
    if (typeConfigs.length > 0 && baseColumns.length === 0) {
      baseColumns = FALLBACK_EXPENSE_COLUMNS;
    }

    const nafLaborMonth =
      periodMonth != null
        ? await getNafLaborCostByContractForMonth(
            periodMonth.getFullYear(),
            periodMonth.getMonth() + 1,
            session.user.company
              ?? (companyValues.length === 1 ? companyValues[0] : undefined),
          )
        : null;

    const profitabilityRows = await getProfitabilityForContracts(
      contracts,
      periodMonth,
      partida,
      nafLaborMonth?.byContract ?? null,
      nafLaborMonth?.byContractCargas ?? null,
    );

    const rows = profitabilityRows.map((prof, index) => {
      const c = contracts[index]!;
      const expensesByTypeMerged = mergeLegacyForReportPartida(prof, partida);
      const { contractId: _profContractId, ...profRest } = prof;
      return {
        contractId: c.id,
        licitacionNo: c.licitacionNo,
        company: c.company,
        client: c.client,
        clientType: c.clientType,
        status: c.status,
        officersCount: c.officersCount,
        positionsCount: c.positionsCount,
        equivalencePct: parseFloat(c.equivalencePct.toString()),
        expensesByTypeMerged,
        ...profRest,
      };
    });

    const showDeferredLegacyCol = rows.some((r) => (r.expensesByTypeMerged[DEFERRED_LEGACY_TYPE] ?? 0) > 0);

    const baseList = [
      ...baseColumns.map(({ type, label }) => ({ type, label })),
      ...(showDeferredLegacyCol
        ? [{ type: DEFERRED_LEGACY_TYPE, label: "Diferidos (dist. legacy)" }]
        : []),
    ];

    const columnTypes = new Set(baseList.map((c) => c.type));
    const extraCols: { type: string; label: string }[] = [];
    for (const r of rows) {
      for (const [type, amount] of Object.entries(r.expensesByTypeMerged)) {
        if (amount > 0 && !columnTypes.has(type)) {
          columnTypes.add(type);
          const fb = FALLBACK_EXPENSE_COLUMNS.find((x) => x.type === type);
          extraCols.push({
            type,
            label: fb?.label ?? type.replace(/_/g, " "),
          });
        }
      }
    }

    function columnSortKey(type: string): number {
      if (type === DEFERRED_LEGACY_TYPE) return 9999;
      const fb = FALLBACK_EXPENSE_COLUMNS.find((x) => x.type === type);
      if (fb) return fb.sortOrder;
      return 100;
    }

    const expenseTypeColumns = [...baseList, ...extraCols].sort(
      (a, b) => columnSortKey(a.type) - columnSortKey(b.type)
    );

    const totalsByType: Record<string, number> = {};
    for (const col of expenseTypeColumns) {
      totalsByType[col.type] = rows.reduce(
        (s, r) => s + (r.expensesByTypeMerged[col.type] ?? 0),
        0
      );
    }

    const totals = {
      partida,
      totalBilling: rows.reduce((s, r) => s + r.monthlyBilling, 0),
      totalLaborBudget: rows.reduce((s, r) => s + r.laborBudget, 0),
      totalSuppliesBudget: rows.reduce((s, r) => s + r.suppliesBudget, 0),
      totalAdminBudget: rows.reduce((s, r) => s + r.adminBudget, 0),
      totalProfitBudget: rows.reduce((s, r) => s + r.profitBudget, 0),
      totalLaborSpend: rows.reduce((s, r) => s + r.rubroTraffic.LABOR.spend, 0),
      totalSuppliesSpend: rows.reduce((s, r) => s + r.rubroTraffic.SUPPLIES.spend, 0),
      totalAdminSpend: rows.reduce((s, r) => s + r.rubroTraffic.ADMIN.spend, 0),
      totalProfitSpend: rows.reduce((s, r) => s + r.rubroTraffic.PROFIT.spend, 0),
      /** Presupuesto según filtro (solo distinto de 0 cuando hay partida concreta) */
      totalReportBudget:
        partida === "ALL"
          ? 0
          : rows.reduce((s, r) => s + r.reportBudget, 0),
      totalUniforms: rows.reduce((s, r) => s + r.uniformsTotal, 0),
      totalAudit: rows.reduce((s, r) => s + r.auditTotal, 0),
      totalDeferred: rows.reduce((s, r) => s + r.deferredTotal, 0),
      totalAdmin: rows.reduce((s, r) => s + r.adminTotal, 0),
      totalExpenses: rows.reduce((s, r) => s + r.grandTotal, 0),
      avgUsagePct: rows.length > 0 ? rows.reduce((s, r) => s + r.budgetUsagePct, 0) / rows.length : 0,
      totalsByType,
    };

    const payload = { rows, totals, expenseTypeColumns };
    setProfitabilityReportCache(cacheKey, payload);
    return ok(payload);
  } catch (e) {
    return serverError("Error generando reporte de rentabilidad", e);
  }
}
