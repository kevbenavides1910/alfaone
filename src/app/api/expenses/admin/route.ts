import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canManageExpenses } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, conflict, serverError } from "@/lib/api/response";
import { adminExpenseSchema } from "@/modules/presupuestos/validations/expense.schema";
import { fromMonthString } from "@/lib/utils/format";
import { requireCompanyCode } from "@/modules/core/services/companies";
import { dbForSession, resolveTenantCompany, assertTenantCompanyAccess } from "@/modules/core/db/db-for-session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");
  const month = searchParams.get("month");

  const db = dbForSession(session);
  const where: Record<string, unknown> = {};
  const effectiveCompany = resolveTenantCompany(session, company);
  if (effectiveCompany) where.company = effectiveCompany;
  if (month) where.periodMonth = fromMonthString(month);

  const pageParam = parseInt(searchParams.get("page") ?? "1");
  const pageSizeParam = Math.min(parseInt(searchParams.get("pageSize") ?? "200"), 500);

  const expenses = await db.adminExpense.findMany({
    where,
    orderBy: [{ periodMonth: "desc" }],
    skip: (pageParam - 1) * pageSizeParam,
    take: pageSizeParam,
  });

  return ok(expenses.map((e) => ({
    ...e,
    transport: parseFloat(e.transport.toString()),
    adminCosts: parseFloat(e.adminCosts.toString()),
    phones: parseFloat(e.phones.toString()),
    phoneLines: parseFloat(e.phoneLines.toString()),
    fuel: parseFloat(e.fuel.toString()),
    otherAmount: parseFloat(e.otherAmount.toString()),
    totalAmount: parseFloat(e.totalAmount.toString()),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageExpenses(session)) return forbidden();

  try {
    const body = await req.json();
    const parsed = adminExpenseSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const data = parsed.data;
    const tenantOk = assertTenantCompanyAccess(session, data.company);
    if (!tenantOk.ok) return badRequest(tenantOk.message);
    const companyOk = await requireCompanyCode(prisma, data.company, { mustBeActive: true });
    if (!companyOk.ok) return badRequest(companyOk.message);

    const db = dbForSession(session);
    const periodMonth = fromMonthString(data.periodMonth);

    // Check duplicate
    const existing = await db.adminExpense.findUnique({
      where: { company_periodMonth: { company: data.company, periodMonth } },
    });
    if (existing) return conflict("Ya existe un registro de gastos administrativos para esta empresa y período");

    const totalAmount = data.transport + data.adminCosts + data.phones + data.phoneLines + data.fuel + data.otherAmount;

    const expense = await db.adminExpense.create({
      data: { ...data, periodMonth, totalAmount, createdById: session.user.id },
    });

    return created({ ...expense, totalAmount: parseFloat(expense.totalAmount.toString()) });
  } catch (e) {
    return serverError("Error al crear gastos administrativos", e);
  }
}
