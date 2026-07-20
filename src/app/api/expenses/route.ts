import { NextRequest } from "next/server";
import { Prisma, type ExpenseType, type ExpenseApprovalStatus } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canManageExpenses } from "@/lib/api/middleware";
import { listExpensesForSession } from "@/modules/presupuestos/services/expenses-list";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { expenseCreateSchema } from "@/modules/presupuestos/validations/expense.schema";
import { createExpense } from "@/modules/presupuestos/services/create-expense";
import { dbForSession } from "@/modules/core/db/db-for-session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { hasPermission } = await import("@/lib/permissions/check");
  if (!hasPermission(session, "gastos.expenses", "view")) return forbidden();

  try {
    const { searchParams } = new URL(req.url);
    const contractId     = searchParams.get("contractId");
    const distributedTo  = searchParams.get("distributedTo"); // deferred expenses distributed to a contract
    const isDeferredParam = searchParams.get("isDeferred");
    const company = searchParams.get("company");
    const type = searchParams.get("type") as ExpenseType | null;
    const approvalStatusParam = searchParams.get("approvalStatus");
    const approvalStatus =
      approvalStatusParam && approvalStatusParam !== "all"
        ? (approvalStatusParam as ExpenseApprovalStatus | "PENDING")
        : null;
    const q = searchParams.get("q")?.trim();
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "50");
    const limitParam = searchParams.get("limit");

    // Lightweight search endpoint used by pickers (e.g. inventory intake)
    if (q) {
      const where: Prisma.ExpenseWhereInput = {
        deletedAt: null,
        OR: [
          { description: { contains: q, mode: "insensitive" } },
          { referenceNumber: { contains: q, mode: "insensitive" } },
          { registroCxp: { contains: q, mode: "insensitive" } },
        ],
      };
      // Tenant enforcement: session company always wins; only platform admins can filter by param
      if (session.user.company) {
        where.company = session.user.company;
      } else if (company) {
        where.company = company;
      }
      if (contractId) where.contractId = contractId;
      const take = Math.min(parseInt(limitParam ?? "15", 10), 50);
      const rows = await dbForSession(session).expense.findMany({
        where,
        select: {
          id: true,
          sequentialNo: true,
          description: true,
          referenceNumber: true,
          registroCxp: true,
          amount: true,
          periodMonth: true,
          type: true,
        },
        orderBy: { createdAt: "desc" },
        take,
      });
      return ok(
        rows.map((r) => ({ ...r, amount: parseFloat(r.amount.toString()) })),
      );
    }

    // Special case: fetch deferred expenses that have been distributed to a specific contract
    if (distributedTo && isDeferredParam === "true") {
      const dists = await prisma.expenseDistribution.findMany({
        where: {
          contractId: distributedTo,
          expense: { approvalStatus: { not: "REJECTED" } },
        },
        include: {
          expense: {
            include: {
              origin: { select: { id: true, name: true } },
              createdBy: { select: { name: true } },
            },
          },
        },
        orderBy: { expense: { periodMonth: "desc" } },
      });

      const serialized = dists.map(d => ({
        ...d.expense,
        amount: parseFloat(d.allocatedAmount.toString()), // show the allocated share
        fullAmount: parseFloat(d.expense.amount.toString()),
        equivalencePct: parseFloat(d.equivalencePct.toString()),
        allocatedAmount: parseFloat(d.allocatedAmount.toString()),
      }));

      return ok(serialized, { page: 1, pageSize: serialized.length, total: serialized.length, totalPages: 1 });
    }

    const result = await listExpensesForSession(session, {
      page,
      pageSize,
      contractId,
      company,
      type,
      approvalStatus,
    });

    return ok(result.data, result.meta);
  } catch (e) {
    return serverError("Error al obtener gastos", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canManageExpenses(session)) return forbidden();

  try {
    const body = await req.json();
    const parsed = expenseCreateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await createExpense({
      db: dbForSession(session),
      input: parsed.data,
      createdById: session.user.id,
      tenantCompany: session.user.company,
    });

    if (!result.ok) {
      if (result.code === "BAD_REQUEST") return badRequest(result.message);
      return serverError(result.message, result.cause);
    }

    return created({
      expenses: result.data.expenses.map((row) => ({
        ...row,
        amount: parseFloat(row.amount.toString()),
      })),
      count: result.data.count,
    });
  } catch (e) {
    return serverError("Error al crear gasto", e);
  }
}
