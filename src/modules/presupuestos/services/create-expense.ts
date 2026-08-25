/**
 * Servicio de creación de gastos.
 *
 * Encapsula la lógica de negocio de creación de gastos (simple, prorrateados o
 * diferidos) en una transacción atómica. El route solo valida auth y delega aquí.
 */

import { Prisma, type PrismaClient, type Expense } from "@prisma/client";

import { getApprovalStepCountForType, initialApprovalFields } from "@/modules/presupuestos/services/expense-approval";
import {
  applyDeferredExpenseDistributionsTx,
  validateManualAllocationsAgainstContracts,
} from "@/modules/presupuestos/services/deferred-expense-distribution";
import { assignableContractStatusWhereInput } from "@/modules/presupuestos/services/assignable-contract-where";
import { splitAmountAcrossMonths, generateProrationMonths } from "@/modules/presupuestos/business/expense-proration";
import type { ExpenseCreateInput } from "@/modules/presupuestos/validations/expense.schema";
import { parseCalendarDateInput, todayCalendarDateString } from "@/lib/utils/format";

type CreateResult = {
  expenses: ExpenseWithIncludes[];
  count: number;
};

type ExpenseWithIncludes = Expense & {
  contract: { id: string; licitacionNo: string; client: string; company: string } | null;
  origin: { id: string; name: string } | null;
};

const include = {
  contract: { select: { id: true, licitacionNo: true, client: true, company: true } },
  origin: { select: { id: true, name: true } },
} as const;

type CreateExpenseOptions = {
  /** Cliente Prisma (usar dbForSession(session) para tenant scope). */
  db: PrismaClient;
  /** Datos validados del schema. */
  input: ExpenseCreateInput;
  /** ID del usuario que crea el gasto. */
  createdById: string;
  /** Empresa del usuario tenant; rechaza crear gastos para otra empresa. */
  tenantCompany?: string | null;
};

export type CreateExpenseError =
  | { ok: false; code: "BAD_REQUEST"; message: string }
  | { ok: false; code: "SERVER_ERROR"; message: string; cause: unknown };

export type CreateExpenseResult = { ok: true; data: CreateResult } | CreateExpenseError;

/**
 * Crea uno o varios gastos y, si aplica, sus distribuciones diferidas en una sola
 * transacción atómica. El prorrateo en meses genera N gastos vinculados con la
 * misma lógica de negocio.
 */
export async function createExpense(options: CreateExpenseOptions): Promise<CreateExpenseResult> {
  const { db, input, createdById, tenantCompany } = options;

  try {
    return await db.$transaction(async (tx) => {
      const result = await createExpenseCore(tx, input, createdById, tenantCompany);
      return { ok: true, data: result } as CreateExpenseResult;
    });
  } catch (e) {
    const message = prismaErrorHint(e);
    if (message) {
      return { ok: false, code: "BAD_REQUEST", message };
    }
    return { ok: false, code: "SERVER_ERROR", message: "Error al crear gasto", cause: e };
  }
}

/**
 * Versión interna que corre dentro de una transacción. Útil si el llamador ya
 * gestiona su propia transacción (por ejemplo, importación masiva).
 */
export async function createExpenseTx(
  tx: Prisma.TransactionClient,
  input: ExpenseCreateInput,
  createdById: string,
  tenantCompany?: string | null,
): Promise<CreateResult> {
  return createExpenseCore(tx, input, createdById, tenantCompany);
}

// ── Core ─────────────────────────────────────────────────────────────────────

async function createExpenseCore(
  tx: Prisma.TransactionClient,
  input: ExpenseCreateInput,
  createdById: string,
  tenantCompany?: string | null,
): Promise<CreateResult> {
  const {
    periodMonth,
    paymentDate: rawPaymentDate,
    amount,
    spreadMonths: rawSpread,
    description,
    type,
    budgetLine,
    contractId,
    positionId,
    originId,
    referenceNumber,
    company,
    isDeferred,
    notes,
    registroCxp,
    registroTr,
    deferredIncludeContractIds: rawDeferredContractIds,
    deferredManualAllocations: rawManualAllocations,
  } = input;

  if (tenantCompany && company !== tenantCompany) {
    throw new ValidationError("No puede crear gastos para otra empresa");
  }

  const hasManualDeferred = Boolean(rawManualAllocations?.length);

  const deferredIncludeContractIds = hasManualDeferred
    ? [...new Set(rawManualAllocations!.map((r) => r.contractId))]
    : isDeferred && rawDeferredContractIds && rawDeferredContractIds.length > 0
      ? rawDeferredContractIds
      : [];

  const companyRow = await tx.company.findUnique({ where: { code: company } });
  if (!companyRow) {
    throw new ValidationError("Empresa no registrada");
  }
  if (!companyRow.isActive) {
    throw new ValidationError("Empresa inactiva");
  }

  if (hasManualDeferred) {
    const manualOk = await validateManualAllocationsAgainstContracts(tx, rawManualAllocations!);
    if (!manualOk.ok) {
      throw new ValidationError(manualOk.message);
    }
  } else if (isDeferred && deferredIncludeContractIds.length > 0) {
    const okIds = await tx.contract.findMany({
      where: {
        id: { in: deferredIncludeContractIds },
        deletedAt: null,
        ...assignableContractStatusWhereInput(),
      },
      select: { id: true },
    });
    if (okIds.length !== deferredIncludeContractIds.length) {
      throw new ValidationError("Algunos contratos no son válidos o no están activos para reparto");
    }
  }

  const spreadMonths = isDeferred ? 1 : rawSpread;
  const months = generateProrationMonths(periodMonth, spreadMonths);
  const paymentDate =
    parseCalendarDateInput(rawPaymentDate) ??
    parseCalendarDateInput(todayCalendarDateString()) ??
    new Date();

  const stepCount = await getApprovalStepCountForType(type);
  const approval = initialApprovalFields(stepCount);

  const common = {
    type,
    budgetLine,
    contractId: contractId || null,
    positionId: positionId || null,
    originId: originId || null,
    referenceNumber: referenceNumber || null,
    company,
    isDeferred,
    notes: notes || null,
    registroCxp: registroCxp?.trim() || null,
    registroTr: registroTr?.trim() || null,
    createdById,
    approvalStatus: approval.approvalStatus,
    currentApprovalStep: approval.currentApprovalStep,
    requiredApprovalSteps: approval.requiredApprovalSteps,
    deferredIncludeContractIds: isDeferred ? deferredIncludeContractIds : [],
    deferredManualDistribution: hasManualDeferred,
    ...(hasManualDeferred
      ? { deferredManualAllocations: rawManualAllocations! as Prisma.InputJsonValue }
      : { deferredManualAllocations: Prisma.JsonNull }),
  };

  const desc = description.trim();
  const amounts = splitAmountAcrossMonths(amount, spreadMonths);

  const createdRows: ExpenseWithIncludes[] = [];

  for (let i = 0; i < spreadMonths; i++) {
    const expense = await tx.expense.create({
      data: {
        ...common,
        description: spreadMonths <= 1 ? desc : `${desc} (mes ${i + 1}/${spreadMonths})`,
        amount: amounts[i],
        periodMonth: months[i],
        paymentDate,
      },
      include,
    });

    if (isDeferred) {
      await applyDeferredExpenseDistributionsTx(tx, expense.id);
    }

    createdRows.push(expense);
  }

  return {
    expenses: createdRows.map((row) => ({
      ...row,
      amount: row.amount, // Prisma Decimal se serializa en JSON como string
    })),
    count: createdRows.length,
  };
}

// ── Errores ─────────────────────────────────────────────────────────────────

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function prismaErrorHint(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /PLANILLA/i.test(msg) ||
    /not found in enum/i.test(msg) ||
    /Invalid value for argument [`']type[`']/i.test(msg) ||
    /Value.*ExpenseType|ExpenseType.*enum/i.test(msg)
  ) {
    return "El tipo «Planilla» u otro valor de enum no coincide con la base de datos. Ejecute: npm run db:fix-planilla-enum (o npx prisma db push) y reinicie el servidor Next.";
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") {
      return "Referencia inválida: verifique contrato, origen o puesto seleccionados.";
    }
  }
  if (err instanceof ValidationError) {
    return err.message;
  }
  return null;
}
