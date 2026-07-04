import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, conflict, serverError } from "@/lib/api/response";
import { contractCreateSchema } from "@/modules/presupuestos/validations/contract.schema";
import { recalculateEquivalence, getGlobalPartidaTotals } from "@/modules/presupuestos/business/equivalence";
import { autoExpireContracts } from "@/modules/presupuestos/business/autoExpire";
import { buildContractListWhere } from "@/modules/presupuestos/services/contracts-list-where";
import { enrichContractsListRows } from "@/modules/presupuestos/services/contracts-list-enrichment";
import { requireCompanyCode } from "@/modules/core/services/companies";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { hasPermission } = await import("@/lib/permissions/check");
  if (!hasPermission(session, "presupuestos.contracts", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50");

  const where = buildContractListWhere(session, searchParams);

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
    getGlobalPartidaTotals(new Date()),
  ]);

  const pageIds = contracts.map((c) => c.id);
  const pageHistory =
    pageIds.length > 0
      ? await prisma.billingHistory.findMany({
          where: { contractId: { in: pageIds } },
          select: { contractId: true, periodMonth: true, monthlyBilling: true },
        })
      : [];
  const asOf = new Date();
  const enriched = enrichContractsListRows(contracts, pageHistory, globalTotals, asOf);

  return ok(enriched, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
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
