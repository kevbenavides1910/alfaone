import type { Prisma } from "@prisma/client";
import type { ContractUpdateInput } from "@/modules/presupuestos/validations/contract.schema";

/** Mapeo explícito para Prisma (ContractUncheckedUpdateInput). */
export function buildContractPrismaUpdate(
  parsed: ContractUpdateInput,
  suppliesPct: number | undefined,
  updatedById: string
): Prisma.ContractUncheckedUpdateInput {
  const data: Prisma.ContractUncheckedUpdateInput = { updatedById };

  if (parsed.company !== undefined) data.company = parsed.company;
  if (parsed.client !== undefined) data.client = parsed.client;
  if (parsed.clientType !== undefined) data.clientType = parsed.clientType;
  if (parsed.hiringType !== undefined) data.hiringType = parsed.hiringType;
  if (parsed.officersCount !== undefined) data.officersCount = parsed.officersCount;
  if (parsed.positionsCount !== undefined) data.positionsCount = parsed.positionsCount;
  if (parsed.startDate !== undefined) data.startDate = new Date(parsed.startDate);
  if (parsed.endDate !== undefined) data.endDate = new Date(parsed.endDate);
  if (parsed.monthlyBilling !== undefined) data.monthlyBilling = parsed.monthlyBilling;
  if (parsed.ivaPct !== undefined) data.ivaPct = parsed.ivaPct;
  if (parsed.billingDay !== undefined) data.billingDay = parsed.billingDay;
  if (parsed.billingPeriodFromDay !== undefined) {
    data.billingPeriodFromDay = parsed.billingPeriodFromDay;
  }
  if (parsed.billingPeriodToDay !== undefined) {
    data.billingPeriodToDay = parsed.billingPeriodToDay;
  }
  if (parsed.laborPct !== undefined) data.laborPct = parsed.laborPct;
  if (parsed.adminPct !== undefined) data.adminPct = parsed.adminPct;
  if (parsed.profitPct !== undefined) data.profitPct = parsed.profitPct;
  if (parsed.status !== undefined) data.status = parsed.status;
  if (parsed.notes !== undefined) data.notes = parsed.notes?.trim() ? parsed.notes : null;
  if (parsed.administrationsCount !== undefined) {
    data.administrationsCount = parsed.administrationsCount;
  }
  if (suppliesPct !== undefined) {
    data.suppliesPct = suppliesPct;
    data.suppliesBudgetPct = suppliesPct;
  }

  return data;
}
