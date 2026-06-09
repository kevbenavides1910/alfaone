import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { unauthorized, badRequest } from "@/lib/api/response";
import { getGlobalPartidaTotals, getGlobalPartidaTotalsForPeriod } from "@/modules/presupuestos/business/equivalence";
import { autoExpireContracts } from "@/modules/presupuestos/business/autoExpire";
import { buildContractListWhere } from "@/modules/presupuestos/services/contracts-list-where";
import { enrichContractsListRows } from "@/modules/presupuestos/services/contracts-list-enrichment";
import {
  contractVigenteInMonthWhere,
  parseContractListPeriod,
  type DemandBillingRow,
} from "@/modules/presupuestos/business/contractPeriodBilling";
import { companyDisplayName, CONTRACT_STATUS_LABELS, CLIENT_TYPE_LABELS, HIRING_TYPE_LABELS } from "@/lib/utils/constants";
import type { ContractStatus, ClientType, ContractHiringType } from "@prisma/client";

const EXPORT_MAX = 10_000;

function fmtDate(v: Date | string): string {
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return unauthorized();

  await autoExpireContracts();

  const { searchParams } = new URL(req.url);

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

  const [contracts, globalTotals] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: [{ company: "asc" }, { client: "asc" }],
      take: EXPORT_MAX,
    }),
    period.usePeriodView
      ? getGlobalPartidaTotalsForPeriod(period.periodYear, period.periodMonth)
      : getGlobalPartidaTotals(new Date()),
  ]);

  const ids = contracts.map((c) => c.id);
  const [allHistory, allDemand] = await Promise.all([
    ids.length > 0
      ? prisma.billingHistory.findMany({
          where: { contractId: { in: ids } },
          select: { contractId: true, periodMonth: true, monthlyBilling: true },
        })
      : [],
    period.usePeriodView && ids.length > 0
      ? prisma.contractDemandBilling.findMany({
          where: {
            contractId: { in: ids },
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
  for (const row of allDemand) {
    const arr = demandByContractId.get(row.contractId) ?? [];
    arr.push(row);
    demandByContractId.set(row.contractId, arr);
  }

  const rows = period.usePeriodView
    ? enrichContractsListRows(contracts, allHistory, globalTotals, {
        periodYear: period.periodYear,
        periodMonth: period.periodMonth,
        demandByContractId,
      })
    : enrichContractsListRows(contracts, allHistory, globalTotals, new Date());

  const companyCatalog = await prisma.company.findMany({
    select: { code: true, name: true },
  });

  const header = [
    "Licitación",
    "Cliente",
    "Empresa",
    "Tipo cliente",
    "Contratación",
    "Oficiales",
    "Puestos",
    "Facturación mensual (efectiva)",
    "M.O. ₡",
    "M.O. %",
    "Insumos ₡",
    "Insumos %",
    "Adm. ₡",
    "Adm. %",
    "Utilidad ₡",
    "Utilidad %",
    "Part. glob. facturación %",
    "Part. glob. M.O. %",
    "Part. glob. insumos %",
    "Part. glob. adm. %",
    "Part. glob. utilidad %",
    "Estado",
    "Inicio",
    "Vencimiento",
    "Notas",
  ];

  const dataRows = rows.map((c) => {
    const companyCode = c.company;
    const status = c.status as ContractStatus;
    const ct = c.clientType as ClientType;
    const ht = c.hiringType as ContractHiringType;
    return [
      c.licitacionNo,
      c.client,
      companyDisplayName(companyCode, companyCatalog),
      CLIENT_TYPE_LABELS[ct] ?? ct,
      HIRING_TYPE_LABELS[ht] ?? ht,
      c.officersCount,
      c.positionsCount,
      c.amountDefined && c.monthlyBilling != null
        ? Math.round(c.monthlyBilling * 100) / 100
        : "",
      c.amountDefined && c.laborBudget != null ? Math.round(c.laborBudget * 100) / 100 : "",
      Math.round(c.laborPct * 10000) / 100,
      c.amountDefined && c.suppliesBudget != null ? Math.round(c.suppliesBudget * 100) / 100 : "",
      Math.round(c.suppliesBudgetPct * 10000) / 100,
      c.amountDefined && c.adminBudget != null ? Math.round(c.adminBudget * 100) / 100 : "",
      Math.round(c.adminPct * 10000) / 100,
      c.amountDefined && c.profitBudget != null ? Math.round(c.profitBudget * 100) / 100 : "",
      Math.round(c.profitPct * 10000) / 100,
      c.amountDefined
        ? Math.round(c.billingSharePct * 10000) / 100
        : "",
      c.amountDefined
        ? Math.round(c.laborSharePct * 10000) / 100
        : "",
      c.amountDefined
        ? Math.round(c.suppliesSharePct * 10000) / 100
        : "",
      c.amountDefined
        ? Math.round(c.adminSharePct * 10000) / 100
        : "",
      c.amountDefined
        ? Math.round(c.profitSharePct * 10000) / 100
        : "",
      CONTRACT_STATUS_LABELS[status] ?? status,
      fmtDate(c.startDate),
      fmtDate(c.endDate),
      (c.notes ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
    ];
  });

  const aoa = [header, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = header.map((h) => ({ wch: Math.min(Math.max(String(h).length + 2, 12), 40) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contratos");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const stamp = new Date();
  const periodSuffix = period.usePeriodView
    ? `_${period.periodYear}-${String(period.periodMonth).padStart(2, "0")}`
    : "";
  const fname = `contratos${periodSuffix}_${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getDate()).padStart(2, "0")}.xlsx`;

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "X-Export-Row-Count": String(dataRows.length),
    },
  });
}
