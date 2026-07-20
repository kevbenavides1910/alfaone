import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, conflict, serverError } from "@/lib/api/response";
import { contractCreateSchema } from "@/modules/presupuestos/validations/contract.schema";
import { recalculateEquivalence, getGlobalPartidaTotals, getGlobalPartidaTotalsForPeriod } from "@/modules/presupuestos/business/equivalence";
import { autoExpireContracts } from "@/modules/presupuestos/business/autoExpire";
import { buildContractListWhere } from "@/modules/presupuestos/services/contracts-list-where";
import { enrichContractsListRows } from "@/modules/presupuestos/services/contracts-list-enrichment";
import { computeContractsListPeriodTotals } from "@/modules/presupuestos/services/contracts-list-period-totals";
import { requireCompanyCode } from "@/modules/core/services/companies";
import {
  contractVigenteInMonthWhere,
  parseContractListPeriod,
  type DemandBillingRow,
} from "@/modules/presupuestos/business/contractPeriodBilling";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { hasPermission } = await import("@/lib/permissions/check");
  if (!hasPermission(session, "presupuestos.contracts", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50");

  let period: ReturnType<typeof parseContractListPeriod>;
  try {
    period = parseContractListPeriod(searchParams);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Período inválido");
  }

  const where = buildContractListWhere(session, searchParams);
  if (period.usePeriodView) {
    Object.assign(where, contractVigenteInMonthWhere(period.periodYear, period.periodMonth));
  }

  // Auto-expire contracts whose endDate has passed
  await autoExpireContracts();

  const [contracts, total, globalTotals] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: [{ company: "asc" }, { client: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contract.count({ where }),
    period.usePeriodView
      ? getGlobalPartidaTotalsForPeriod(period.periodYear, period.periodMonth)
      : getGlobalPartidaTotals(new Date()),
  ]);

  const pageIds = contracts.map((c) => c.id);
  const [pageHistory, pageDemand] = await Promise.all([
    pageIds.length > 0
      ? prisma.billingHistory.findMany({
          where: { contractId: { in: pageIds } },
          select: { contractId: true, periodMonth: true, monthlyBilling: true },
        })
      : [],
    period.usePeriodView && pageIds.length > 0
      ? prisma.contractDemandBilling.findMany({
          where: {
            contractId: { in: pageIds },
            periodYear: period.periodYear,
            periodMonth: period.periodMonth,
          },
          select: {
            contractId: true,
            periodYear: true,
            periodMonth: true,
            monthlyBilling: true,
          },
        })
      : [],
  ]);

  const demandByContractId = new Map<string, DemandBillingRow[]>();
  for (const row of pageDemand) {
    const arr = demandByContractId.get(row.contractId) ?? [];
    arr.push(row);
    demandByContractId.set(row.contractId, arr);
  }

  const enrichedBase = period.usePeriodView
    ? enrichContractsListRows(contracts, pageHistory, globalTotals, {
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        demandByContractId,
      })
    : enrichContractsListRows(contracts, pageHistory, globalTotals, new Date());

  if (period.usePeriodView) {
    const allContracts = await prisma.contract.findMany({
      where,
      orderBy: [{ company: "asc" }, { client: "asc" }],
    });
    const computed = await computeContractsListPeriodTotals(
      allContracts,
      period.periodYear,
      period.periodMonth,
    );
    const enriched = enrichedBase.map((row) => {
      const spend = computed.byContractId.get(row.id);
      if (!spend) return row;
      return {
        ...row,
        laborSpend: spend.laborSpend,
        suppliesSpend: spend.suppliesSpend,
        adminSpend: spend.adminSpend,
        profitSpend: spend.profitSpend,
        periodGrandTotal: spend.grandTotal,
      };
    });
    return ok(enriched, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      periodYear: period.periodYear,
      periodMonth: period.periodMonth,
      usePeriodView: period.usePeriodView,
      periodTotals: computed.totals,
    });
  }

  return ok(enrichedBase, {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    periodYear: period.periodYear,
    periodMonth: period.periodMonth,
    usePeriodView: period.usePeriodView,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  try {
    const body = await req.json();
    const parsed = contractCreateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const data = parsed.data;

    const companyOk = await requireCompanyCode(prisma, data.company, { mustBeActive: true });
    if (!companyOk.ok) return badRequest(companyOk.message);

    // Check duplicate
    const existing = await prisma.contract.findUnique({
      where: { licitacionNo: data.licitacionNo },
    });
    if (existing) return conflict(`Ya existe un contrato con licitación ${data.licitacionNo}`);

    const contract = await prisma.contract.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        monthlyBilling: data.monthlyBilling,
        suppliesBudgetPct: data.suppliesPct,
        createdById: session.user.id,
      },
    });

    // Recalculate global equivalence (supplies-budget-based across all contracts)
    await recalculateEquivalence();

    // Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        contractId: contract.id,
        entityType: "Contract",
        entityId: contract.id,
        action: "CREATE",
        newData: JSON.stringify(contract),
      },
    });

    return created(contract);
  } catch (e) {
    return serverError("Error al crear contrato", e);
  }
}
