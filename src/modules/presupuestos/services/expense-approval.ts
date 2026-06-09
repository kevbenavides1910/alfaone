import type { ExpenseApprovalStatus, ExpenseType } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type { Session } from "next-auth";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { hasPermission } from "@/lib/permissions/check";

export async function getApprovalStepCountForType(type: ExpenseType): Promise<number> {
  return prisma.expenseTypeApprovalStep.count({ where: { expenseType: type } });
}

export async function getApprovalChainForType(type: ExpenseType) {
  return prisma.expenseTypeApprovalStep.findMany({
    where: { expenseType: type },
    orderBy: { stepOrder: "asc" },
    include: { approver: { select: { id: true, name: true, email: true } } },
  });
}

export function initialApprovalFields(stepCount: number): {
  approvalStatus: ExpenseApprovalStatus;
  currentApprovalStep: number | null;
  requiredApprovalSteps: number;
} {
  if (stepCount <= 0) {
    return {
      approvalStatus: "APPROVED",
      currentApprovalStep: null,
      requiredApprovalSteps: 0,
    };
  }
  return {
    approvalStatus: "PENDING_APPROVAL",
    currentApprovalStep: 1,
    requiredApprovalSteps: stepCount,
  };
}

export async function canViewExpenseDetail(session: Session, expenseId: string): Promise<boolean> {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: {
      company: true,
      createdById: true,
      type: true,
      currentApprovalStep: true,
      approvalStatus: true,
    },
  });
  if (!expense) return false;
  if (isPlatformAdmin(session) || hasPermission(session, "gastos.expenses", "admin")) return true;
  if (expense.createdById === session.user.id) return true;

  const decided = await prisma.expenseApproval.findFirst({
    where: { expenseId, approverUserId: session.user.id },
  });
  if (decided) return true;

  if (
    expense.currentApprovalStep != null &&
    expense.approvalStatus !== "APPROVED" &&
    expense.approvalStatus !== "REJECTED"
  ) {
    const step = await prisma.expenseTypeApprovalStep.findUnique({
      where: {
        expenseType_stepOrder: {
          expenseType: expense.type,
          stepOrder: expense.currentApprovalStep,
        },
      },
    });
    if (step?.approverUserId === session.user.id) return true;
  }

  if (session.user.company && expense.company !== session.user.company) return false;

  return true;
}

export async function isCurrentApprover(session: Session, expenseId: string): Promise<boolean> {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { type: true, currentApprovalStep: true, approvalStatus: true },
  });
  if (!expense?.currentApprovalStep) return false;
  if (expense.approvalStatus === "APPROVED" || expense.approvalStatus === "REJECTED") return false;
  const step = await prisma.expenseTypeApprovalStep.findUnique({
    where: {
      expenseType_stepOrder: {
        expenseType: expense.type,
        stepOrder: expense.currentApprovalStep,
      },
    },
  });
  return step?.approverUserId === session.user.id;
}
