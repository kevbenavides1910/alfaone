import type { ExpenseBudgetLine } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/utils/constants";
import {
  getNafLaborCostByContractForMonth,
  getNafLaborEmployeeBreakdownForContractMonth,
  getNafLaborEmployeeBreakdownForMonth,
  resolveNafLaborSpendForContract,
  type NafLaborEmployeeBreakdownLine,
} from "@/modules/empleados-naf/services/naf-labor-report";
import {
  isNafEmployeeExcludedFromRubros,
  isNafLaborCountedAsAdmin,
} from "@/modules/presupuestos/business/naf-labor-rubro";

export type RubroSpendKey = "LABOR" | "SUPPLIES" | "ADMIN" | "PROFIT";

export type RubroSpendLineItem = {
  id: string;
  group: string;
  label: string;
  detail: string | null;
  amount: number;
  href: string | null;
};

export type RubroSpendBreakdown = {
  rubro: RubroSpendKey;
  rubroLabel: string;
  total: number;
  laborSource: "naf" | "manual" | null;
  items: RubroSpendLineItem[];
  /** Desglose NAF por empleado con contratos de asistencia (solo MO). */
  laborEmployees?: NafLaborEmployeeBreakdownLine[];
};

const RUBRO_LABELS: Record<RubroSpendKey, string> = {
  LABOR: "Mano de obra",
  SUPPLIES: "Insumos",
  ADMIN: "Administrativo",
  PROFIT: "Utilidad",
};

const ADMIN_PAYROLL_GROUP = "Planilla administrativa";

function toNum(v: { toString(): string } | number | string): number {
  return parseFloat(v.toString());
}

function monthRange(periodMonth: Date): { gte: Date; lte: Date } {
  const y = periodMonth.getFullYear();
  const m = periodMonth.getMonth();
  return {
    gte: new Date(y, m, 1),
    lte: new Date(y, m + 1, 0, 23, 59, 59),
  };
}

function expenseTypeLabel(type: string): string {
  if (type === "DEFERRED_LEGACY") return "Diferidos (dist. legacy)";
  return EXPENSE_CATEGORY_LABELS[type] ?? type.replace(/_/g, " ");
}

function pushItem(
  items: RubroSpendLineItem[],
  item: Omit<RubroSpendLineItem, "amount"> & { amount: number },
) {
  if (item.amount <= 0) return;
  items.push(item);
}

export async function getContractRubroSpendBreakdown(
  contractId: string,
  periodMonth: Date,
  rubro: RubroSpendKey,
): Promise<RubroSpendBreakdown> {
  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: { id: true, company: true, licitacionNo: true },
  });

  const range = monthRange(periodMonth);
  const items: RubroSpendLineItem[] = [];
  let laborSource: RubroSpendBreakdown["laborSource"] = null;
  let laborEmployees: NafLaborEmployeeBreakdownLine[] | undefined;

  const nafAsAdmin = isNafLaborCountedAsAdmin(contract);

  if (rubro === "LABOR") {
    if (nafAsAdmin) {
      // Personal administrativo: la nómina NAF se imputa a ADMIN, no a MO.
      laborSource = "manual";
      await appendExpenseLineItems(items, contractId, range, "LABOR");
    } else {
      const nafLaborMonth = await getNafLaborCostByContractForMonth(
        periodMonth.getFullYear(),
        periodMonth.getMonth() + 1,
        contract.company,
      );
      const nafSpend = resolveNafLaborSpendForContract(nafLaborMonth, contractId);

      if (nafSpend !== undefined) {
        laborSource = "naf";
        const { employees } = await getNafLaborEmployeeBreakdownForContractMonth(
          contractId,
          periodMonth.getFullYear(),
          periodMonth.getMonth() + 1,
          contract.company,
        );
        laborEmployees = employees;
        for (const emp of employees) {
          const onContract =
            emp.contratos.find((c) => c.contractId === contractId)?.brutoConCargasSociales ?? 0;
          pushItem(items, {
            id: `naf-${emp.sourceKey}`,
            group: emp.nominaNombre ?? "Nómina NAF",
            label: emp.nombre?.trim() || `Empleado ${emp.noEmple}`,
            detail: [
              emp.noEmple,
              emp.codPla ? `Planilla ${emp.codPla}` : null,
              emp.contratos.length > 1 ? `${emp.contratos.length} contratos en el mes` : null,
            ]
              .filter(Boolean)
              .join(" · "),
            amount: onContract,
            href: "/empleados-naf/nomina",
          });
        }
      } else {
        laborSource = "manual";
        await appendExpenseLineItems(items, contractId, range, "LABOR");
      }
    }
  } else if (rubro === "SUPPLIES") {
    await appendExpenseLineItems(items, contractId, range, "SUPPLIES");

    const uniforms = await prisma.uniformExpense.findMany({
      where: { contractId, periodMonth: { gte: range.gte, lte: range.lte } },
    });
    for (const u of uniforms) {
      const total = toNum(u.totalCost);
      pushItem(items, {
        id: `uniform-${u.id}`,
        group: "Uniformes",
        label: `Uniformes ${u.periodMonth.toISOString().slice(0, 7)}`,
        detail: [
          u.shirtQty ? `Camisas ${u.shirtQty}` : null,
          u.pantsQty ? `Pantalones ${u.pantsQty}` : null,
          u.shoesQty ? `Zapatos ${u.shoesQty}` : null,
          u.otherDesc,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        amount: total,
        href: `/contracts/${contractId}`,
      });
    }

    const deferredDists = await prisma.deferredDistribution.findMany({
      where: {
        contractId,
        deferredExpense: { periodMonth: { gte: range.gte, lte: range.lte } },
      },
      include: {
        deferredExpense: { select: { id: true, description: true, periodMonth: true } },
      },
    });
    for (const d of deferredDists) {
      pushItem(items, {
        id: `deferred-${d.id}`,
        group: "Diferidos",
        label: d.deferredExpense.description,
        detail: null,
        amount: toNum(d.allocatedAmount),
        href: "/expenses/deferred",
      });
    }
  } else if (rubro === "ADMIN") {
    await appendExpenseLineItems(items, contractId, range, "ADMIN");

    const adminDists = await prisma.adminDistribution.findMany({
      where: {
        contractId,
        adminExpense: { periodMonth: { gte: range.gte, lte: range.lte } },
      },
      include: {
        adminExpense: {
          select: {
            id: true,
            periodMonth: true,
            otherDesc: true,
            totalAmount: true,
          },
        },
      },
    });
    for (const d of adminDists) {
      const monthLabel = d.adminExpense.periodMonth.toISOString().slice(0, 7);
      pushItem(items, {
        id: `admin-dist-${d.id}`,
        group: "Gasto administrativo (dist.)",
        label: d.adminExpense.otherDesc?.trim() || `Gasto administrativo ${monthLabel}`,
        detail: `Total empresa: ${toNum(d.adminExpense.totalAmount).toLocaleString("es-CR")}`,
        amount: toNum(d.allocatedAmount),
        href: "/expenses/admin",
      });
    }

    const findings = await prisma.auditFinding.findMany({
      where: {
        contractId,
        status: "PENDING",
        findingDate: { gte: range.gte, lte: range.lte },
      },
    });
    for (const f of findings) {
      pushItem(items, {
        id: `audit-${f.id}`,
        group: "Auditoría",
        label: f.postName || "Hallazgo de auditoría",
        detail: f.notes,
        amount: toNum(f.totalCost),
        href: `/contracts/${contractId}`,
      });
    }

    // Personal administrativo: nómina NAF agrupada bajo «Planilla administrativa».
    if (nafAsAdmin) {
      const nafLaborMonth = await getNafLaborCostByContractForMonth(
        periodMonth.getFullYear(),
        periodMonth.getMonth() + 1,
        contract.company,
      );
      const nafSpend = resolveNafLaborSpendForContract(nafLaborMonth, contractId);
      if (nafSpend !== undefined) {
        laborSource = "naf";
        const { employees } = await getNafLaborEmployeeBreakdownForContractMonth(
          contractId,
          periodMonth.getFullYear(),
          periodMonth.getMonth() + 1,
          contract.company,
        );
        let payrollTotal = 0;
        let payrollCargas = 0;
        let payrollCount = 0;
        for (const emp of employees) {
          const row = emp.contratos.find((c) => c.contractId === contractId);
          const onContract = row?.brutoConCargasSociales ?? 0;
          if (onContract <= 0) continue;
          payrollTotal += onContract;
          payrollCargas += row?.cargasSocialesMonto ?? 0;
          payrollCount += 1;
        }
        if (payrollTotal > 0) {
          pushItem(items, {
            id: "naf-admin-payroll",
            group: ADMIN_PAYROLL_GROUP,
            label: "Nómina NAF",
            detail: [
              `${payrollCount} empleado${payrollCount === 1 ? "" : "s"}`,
              payrollCargas > 0
                ? `Cargas sociales: ${payrollCargas.toLocaleString("es-CR")}`
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
            amount: payrollTotal,
            href: "/empleados-naf/nomina",
          });
        }
      }
    }
  } else {
    await appendExpenseLineItems(items, contractId, range, "PROFIT");
  }

  items.sort((a, b) => b.amount - a.amount);
  const total = items.reduce((sum, row) => sum + row.amount, 0);

  return {
    rubro,
    rubroLabel: RUBRO_LABELS[rubro],
    total,
    laborSource,
    items,
    ...(laborEmployees ? { laborEmployees } : {}),
  };
}

function mergeKeyForLineItem(item: RubroSpendLineItem): string {
  if (item.id.startsWith("naf-")) return item.id;
  return `${item.group}\0${item.label}\0${item.detail ?? ""}`;
}

/** Desglose de un rubro sumando varios contratos (p. ej. fila TOTALES del reporte mensual). */
export async function getConsolidatedRubroSpendBreakdown(
  contractIds: string[],
  periodMonth: Date,
  rubro: RubroSpendKey,
): Promise<RubroSpendBreakdown & { contractCount: number }> {
  const uniqueIds = [...new Set(contractIds)];
  if (uniqueIds.length === 0) {
    return {
      rubro,
      rubroLabel: RUBRO_LABELS[rubro],
      total: 0,
      laborSource: null,
      items: [],
      contractCount: 0,
    };
  }

  if (uniqueIds.length === 1) {
    const breakdown = await getContractRubroSpendBreakdown(uniqueIds[0]!, periodMonth, rubro);
    return { ...breakdown, contractCount: 1 };
  }

  return getConsolidatedRubroSpendBreakdownBatch(uniqueIds, periodMonth, rubro);
}

async function getConsolidatedRubroSpendBreakdownBatch(
  contractIds: string[],
  periodMonth: Date,
  rubro: RubroSpendKey,
): Promise<RubroSpendBreakdown & { contractCount: number }> {
  const contractIdSet = new Set(contractIds);
  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds } },
    select: { id: true, company: true, licitacionNo: true },
  });
  const contractById = new Map(contracts.map((row) => [row.id, row]));
  const range = monthRange(periodMonth);
  const year = periodMonth.getFullYear();
  const month = periodMonth.getMonth() + 1;

  const itemMap = new Map<string, RubroSpendLineItem>();
  let laborSource: RubroSpendBreakdown["laborSource"] = null;
  let laborEmployees: NafLaborEmployeeBreakdownLine[] | undefined;

  const mergeItem = (item: RubroSpendLineItem) => {
    const key = mergeKeyForLineItem(item);
    const existing = itemMap.get(key);
    if (existing) {
      existing.amount += item.amount;
    } else {
      itemMap.set(key, { ...item, id: `merged-${key}` });
    }
  };

  if (rubro === "LABOR") {
    const nafContracts = contracts.filter((c) => !isNafLaborCountedAsAdmin(c));
    const manualContracts = contracts.filter((c) => isNafLaborCountedAsAdmin(c));
    const companies = [...new Set(nafContracts.map((c) => c.company))];
    const employeesByCompany = new Map<string, NafLaborEmployeeBreakdownLine[]>();

    for (const company of companies) {
      const companyContractIds = nafContracts
        .filter((c) => c.company === company)
        .map((c) => c.id);
      const nafLaborMonth = await getNafLaborCostByContractForMonth(year, month, company);
      const nafContractIds = companyContractIds.filter(
        (id) => resolveNafLaborSpendForContract(nafLaborMonth, id) !== undefined,
      );

      if (nafContractIds.length > 0) {
        laborSource = "naf";
        const { employees } = await getNafLaborEmployeeBreakdownForMonth(year, month, company);
        employeesByCompany.set(company, employees);
        for (const emp of employees) {
          for (const contrato of emp.contratos) {
            if (!contrato.contractId || !contractIdSet.has(contrato.contractId)) continue;
            const onContract = contrato.brutoConCargasSociales;
            if (onContract <= 0) continue;
            mergeItem({
              id: `naf-${emp.sourceKey}`,
              group: emp.nominaNombre ?? "Nómina NAF",
              label: emp.nombre?.trim() || `Empleado ${emp.noEmple}`,
              detail: [
                emp.noEmple,
                emp.codPla ? `Planilla ${emp.codPla}` : null,
                emp.contratos.length > 1 ? `${emp.contratos.length} contratos en el mes` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              amount: onContract,
              href: "/empleados-naf/nomina",
            });
          }
        }
      }

      for (const contractId of companyContractIds) {
        if (nafContractIds.includes(contractId)) continue;
        const items: RubroSpendLineItem[] = [];
        await appendExpenseLineItems(items, contractId, range, "LABOR");
        if (items.length > 0) laborSource = laborSource ?? "manual";
        for (const item of items) mergeItem(item);
      }
    }

    for (const contract of manualContracts) {
      const items: RubroSpendLineItem[] = [];
      await appendExpenseLineItems(items, contract.id, range, "LABOR");
      if (items.length > 0) laborSource = laborSource ?? "manual";
      for (const item of items) mergeItem(item);
    }

    if (employeesByCompany.size > 0) {
      const empMap = new Map<string, NafLaborEmployeeBreakdownLine>();
      for (const employees of employeesByCompany.values()) {
        for (const emp of employees) {
          if (empMap.has(emp.sourceKey)) continue;
          const amountInScope = emp.contratos
            .filter((c) => c.contractId && contractIdSet.has(c.contractId))
            .reduce((s, c) => s + c.brutoConCargasSociales, 0);
          if (amountInScope <= 0) continue;
          empMap.set(emp.sourceKey, {
            ...emp,
            brutoConCargasSociales: amountInScope,
            devengado: amountInScope,
            cargasSocialesMonto: 0,
            contratos: [],
          });
        }
      }
      laborEmployees = [...empMap.values()].sort(
        (a, b) => b.brutoConCargasSociales - a.brutoConCargasSociales,
      );
    }
  } else if (rubro === "SUPPLIES") {
    await appendExpenseLineItemsBatch(contractIds, range, "SUPPLIES", mergeItem);

    const uniforms = await prisma.uniformExpense.findMany({
      where: {
        contractId: { in: contractIds },
        periodMonth: { gte: range.gte, lte: range.lte },
      },
    });
    for (const u of uniforms) {
      const contract = contractById.get(u.contractId);
      mergeItem({
        id: `uniform-${u.id}`,
        group: "Uniformes",
        label: `Uniformes ${u.periodMonth.toISOString().slice(0, 7)}`,
        detail: [
          u.shirtQty ? `Camisas ${u.shirtQty}` : null,
          u.pantsQty ? `Pantalones ${u.pantsQty}` : null,
          u.shoesQty ? `Zapatos ${u.shoesQty}` : null,
          u.otherDesc,
          contract?.licitacionNo ? `Contrato ${contract.licitacionNo}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        amount: toNum(u.totalCost),
        href: `/contracts/${u.contractId}`,
      });
    }

    const deferredDists = await prisma.deferredDistribution.findMany({
      where: {
        contractId: { in: contractIds },
        deferredExpense: { periodMonth: { gte: range.gte, lte: range.lte } },
      },
      include: {
        deferredExpense: { select: { id: true, description: true, periodMonth: true } },
      },
    });
    for (const d of deferredDists) {
      mergeItem({
        id: `deferred-${d.id}`,
        group: "Diferidos",
        label: d.deferredExpense.description,
        detail: contractById.get(d.contractId)?.licitacionNo ?? null,
        amount: toNum(d.allocatedAmount),
        href: "/expenses/deferred",
      });
    }
  } else if (rubro === "ADMIN") {
    await appendExpenseLineItemsBatch(contractIds, range, "ADMIN", mergeItem);

    const adminDists = await prisma.adminDistribution.findMany({
      where: {
        contractId: { in: contractIds },
        adminExpense: { periodMonth: { gte: range.gte, lte: range.lte } },
      },
      include: {
        adminExpense: {
          select: {
            id: true,
            periodMonth: true,
            otherDesc: true,
            totalAmount: true,
          },
        },
      },
    });
    for (const d of adminDists) {
      const monthLabel = d.adminExpense.periodMonth.toISOString().slice(0, 7);
      mergeItem({
        id: `admin-dist-${d.id}`,
        group: "Gasto administrativo (dist.)",
        label: d.adminExpense.otherDesc?.trim() || `Gasto administrativo ${monthLabel}`,
        detail: `Total empresa: ${toNum(d.adminExpense.totalAmount).toLocaleString("es-CR")}`,
        amount: toNum(d.allocatedAmount),
        href: "/expenses/admin",
      });
    }

    const findings = await prisma.auditFinding.findMany({
      where: {
        contractId: { in: contractIds },
        status: "PENDING",
        findingDate: { gte: range.gte, lte: range.lte },
      },
    });
    for (const f of findings) {
      mergeItem({
        id: `audit-${f.id}`,
        group: "Auditoría",
        label: f.postName || "Hallazgo de auditoría",
        detail: f.notes,
        amount: toNum(f.totalCost),
        href: `/contracts/${f.contractId}`,
      });
    }

    const adminNafContracts = contracts.filter((c) => isNafLaborCountedAsAdmin(c));
    const adminCompanies = [...new Set(adminNafContracts.map((c) => c.company))];
    for (const company of adminCompanies) {
      const nafLaborMonth = await getNafLaborCostByContractForMonth(year, month, company);
      const companyIds = adminNafContracts.filter((c) => c.company === company).map((c) => c.id);
      const hasNaf = companyIds.some(
        (id) => resolveNafLaborSpendForContract(nafLaborMonth, id) !== undefined,
      );
      if (!hasNaf) continue;

      laborSource = "naf";
      const { employees } = await getNafLaborEmployeeBreakdownForMonth(year, month, company);
      let payrollTotal = 0;
      let payrollCargas = 0;
      let payrollCount = 0;
      for (const emp of employees) {
        for (const row of emp.contratos) {
          if (!row.contractId || !contractIdSet.has(row.contractId)) continue;
          const onContract = row.brutoConCargasSociales;
          if (onContract <= 0) continue;
          payrollTotal += onContract;
          payrollCargas += row.cargasSocialesMonto ?? 0;
          payrollCount += 1;
        }
      }
      if (payrollTotal > 0) {
        mergeItem({
          id: "naf-admin-payroll",
          group: ADMIN_PAYROLL_GROUP,
          label: "Nómina NAF",
          detail: [
            `${payrollCount} empleado${payrollCount === 1 ? "" : "s"}`,
            payrollCargas > 0
              ? `Cargas sociales: ${payrollCargas.toLocaleString("es-CR")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
          amount: payrollTotal,
          href: "/empleados-naf/nomina",
        });
      }
    }
  } else {
    await appendExpenseLineItemsBatch(contractIds, range, "PROFIT", mergeItem);
  }

  const items = [...itemMap.values()].sort((a, b) => b.amount - a.amount);
  const total = items.reduce((sum, row) => sum + row.amount, 0);

  return {
    rubro,
    rubroLabel: RUBRO_LABELS[rubro],
    total,
    laborSource,
    items,
    contractCount: contractIds.length,
    ...(laborEmployees?.length ? { laborEmployees } : {}),
  };
}

async function appendExpenseLineItemsBatch(
  contractIds: string[],
  range: { gte: Date; lte: Date },
  budgetLine: ExpenseBudgetLine,
  mergeItem: (item: RubroSpendLineItem) => void,
) {
  const directExpenses = await prisma.expense.findMany({
    where: {
      contractId: { in: contractIds },
      isDeferred: false,
      budgetLine,
      periodMonth: { gte: range.gte, lte: range.lte },
    },
    select: {
      id: true,
      contractId: true,
      type: true,
      description: true,
      amount: true,
      referenceNumber: true,
    },
    orderBy: { amount: "desc" },
  });

  for (const e of directExpenses) {
    mergeItem({
      id: `exp-${e.id}`,
      group: expenseTypeLabel(e.type),
      label: e.description,
      detail: e.referenceNumber,
      amount: toNum(e.amount),
      href: `/expenses?contractId=${e.contractId}`,
    });
  }

  const expenseDists = await prisma.expenseDistribution.findMany({
    where: {
      contractId: { in: contractIds },
      expense: {
        budgetLine,
        approvalStatus: { not: "REJECTED" },
        periodMonth: { gte: range.gte, lte: range.lte },
      },
    },
    include: {
      expense: {
        select: {
          id: true,
          type: true,
          description: true,
          referenceNumber: true,
        },
      },
    },
    orderBy: { allocatedAmount: "desc" },
  });

  for (const d of expenseDists) {
    mergeItem({
      id: `exp-dist-${d.id}`,
      group: `${expenseTypeLabel(d.expense.type)} (dist.)`,
      label: d.expense.description,
      detail: d.expense.referenceNumber,
      amount: toNum(d.allocatedAmount),
      href: `/expenses?contractId=${d.contractId}`,
    });
  }
}

async function appendExpenseLineItems(
  items: RubroSpendLineItem[],
  contractId: string,
  range: { gte: Date; lte: Date },
  budgetLine: ExpenseBudgetLine,
) {
  const directExpenses = await prisma.expense.findMany({
    where: {
      contractId,
      isDeferred: false,
      budgetLine,
      periodMonth: { gte: range.gte, lte: range.lte },
    },
    select: {
      id: true,
      type: true,
      description: true,
      amount: true,
      referenceNumber: true,
    },
    orderBy: { amount: "desc" },
  });

  for (const e of directExpenses) {
    pushItem(items, {
      id: `exp-${e.id}`,
      group: expenseTypeLabel(e.type),
      label: e.description,
      detail: e.referenceNumber,
      amount: toNum(e.amount),
      href: `/expenses?contractId=${contractId}`,
    });
  }

  const expenseDists = await prisma.expenseDistribution.findMany({
    where: {
      contractId,
      expense: {
        budgetLine,
        approvalStatus: { not: "REJECTED" },
        periodMonth: { gte: range.gte, lte: range.lte },
      },
    },
    include: {
      expense: {
        select: {
          id: true,
          type: true,
          description: true,
          referenceNumber: true,
        },
      },
    },
    orderBy: { allocatedAmount: "desc" },
  });

  for (const d of expenseDists) {
    pushItem(items, {
      id: `exp-dist-${d.id}`,
      group: `${expenseTypeLabel(d.expense.type)} (dist.)`,
      label: d.expense.description,
      detail: d.expense.referenceNumber,
      amount: toNum(d.allocatedAmount),
      href: `/expenses?contractId=${contractId}`,
    });
  }
}
