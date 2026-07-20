import type { Session } from "next-auth";
import type { ExpenseApprovalStatus, ExpenseType } from "@prisma/client";
import { dbForSession, resolveTenantCompany } from "@/modules/core/db/db-for-session";

export type ListExpensesOptions = {
  page?: number;
  pageSize?: number;
  contractId?: string | null;
  company?: string | null;
  type?: ExpenseType | null;
  /** Filtro por estado de aprobación. Acepta también el alias "PENDING" que incluye PARTIALLY_APPROVED. */
  approvalStatus?: ExpenseApprovalStatus | "PENDING" | null;
};

/**
 * Misma lógica que GET /api/expenses (listado general). Usada por la ruta API y por la página servidor.
 */
export async function listExpensesForSession(session: Session, opts: ListExpensesOptions = {}) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const db = dbForSession(session);

  const where: Record<string, unknown> = { deletedAt: null };
  const company = resolveTenantCompany(session, opts.company);
  if (company) where.company = company;
  if (opts.contractId) where.contractId = opts.contractId;
  if (opts.type) where.type = opts.type;
  if (opts.approvalStatus) {
    if (opts.approvalStatus === "PENDING") {
      where.approvalStatus = { in: ["PENDING_APPROVAL", "PARTIALLY_APPROVED"] };
    } else {
      where.approvalStatus = opts.approvalStatus;
    }
  }

  const [expenses, total] = await Promise.all([
    db.expense.findMany({
      where,
      include: {
        contract: { select: { id: true, licitacionNo: true, client: true, company: true } },
        position: {
          include: {
            location: { select: { name: true } },
          },
        },
        origin: { select: { id: true, name: true } },
        createdBy: { select: { name: true, id: true } },
        distributions: {
          include: { contract: { select: { licitacionNo: true, client: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.expense.count({ where }),
  ]);

  const data = expenses.map((e) => ({
    ...e,
    amount: parseFloat(e.amount.toString()),
    distributions: e.distributions.map((d) => ({
      ...d,
      equivalencePct: parseFloat(d.equivalencePct.toString()),
      allocatedAmount: parseFloat(d.allocatedAmount.toString()),
    })),
  }));

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
