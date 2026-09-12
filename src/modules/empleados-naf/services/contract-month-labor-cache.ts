import { prisma } from "@/modules/core/db/prisma";
import { computeNafLaborCostByContractForMonth } from "@/modules/empleados-naf/services/naf-labor-report";
import type { NafLaborCostMonthResult } from "@/modules/empleados-naf/services/naf-labor-report";
import { clearProfitabilityReportCache } from "@/modules/presupuestos/services/profitability-report-cache";

const CURRENT_MONTH_TTL_MS = 15 * 60 * 1000;
const PAST_MONTH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheTtlMs(year: number, month: number): number {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  return isCurrentMonth ? CURRENT_MONTH_TTL_MS : PAST_MONTH_TTL_MS;
}

function isCacheFresh(computedAt: Date, year: number, month: number): boolean {
  return Date.now() - computedAt.getTime() < cacheTtlMs(year, month);
}

function monthsOverlappingRange(start: Date, end: Date): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

async function filterLaborMapsByCompany(
  byContract: Map<string, number>,
  byContractCargas: Map<string, number>,
  companyCode?: string,
): Promise<{ byContract: Map<string, number>; byContractCargas: Map<string, number> }> {
  if (!companyCode) {
    return { byContract, byContractCargas };
  }

  const contractIds = [...new Set([...byContract.keys(), ...byContractCargas.keys()])];
  if (contractIds.length === 0) {
    return { byContract: new Map(), byContractCargas: new Map() };
  }

  const allowed = new Set(
    (
      await prisma.contract.findMany({
        where: { id: { in: contractIds }, company: companyCode },
        select: { id: true },
      })
    ).map((row) => row.id),
  );

  const filteredContract = new Map<string, number>();
  const filteredCargas = new Map<string, number>();
  for (const [contractId, amount] of byContract) {
    if (allowed.has(contractId)) filteredContract.set(contractId, amount);
  }
  for (const [contractId, amount] of byContractCargas) {
    if (allowed.has(contractId)) filteredCargas.set(contractId, amount);
  }

  return { byContract: filteredContract, byContractCargas: filteredCargas };
}

function mapsFromCacheRows(
  rows: Array<{
    contractId: string;
    laborSpend: { toString(): string };
    cargasSocialesSpend: { toString(): string };
  }>,
): { byContract: Map<string, number>; byContractCargas: Map<string, number> } {
  const byContract = new Map<string, number>();
  const byContractCargas = new Map<string, number>();
  for (const row of rows) {
    byContract.set(row.contractId, parseFloat(row.laborSpend.toString()));
    byContractCargas.set(row.contractId, parseFloat(row.cargasSocialesSpend.toString()));
  }
  return { byContract, byContractCargas };
}

export async function refreshContractMonthLaborCache(
  year: number,
  month: number,
): Promise<NafLaborCostMonthResult> {
  const computed = await computeNafLaborCostByContractForMonth(year, month);
  const computedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.contractMonthLaborCache.deleteMany({ where: { year, month } });
    if (computed.hasNominaData && computed.byContract.size > 0) {
      await tx.contractMonthLaborCache.createMany({
        data: [...computed.byContract.entries()].map(([contractId, laborSpend]) => ({
          contractId,
          year,
          month,
          laborSpend,
          cargasSocialesSpend: computed.byContractCargas.get(contractId) ?? 0,
          computedAt,
        })),
      });
    }
  });

  clearProfitabilityReportCache();
  return computed;
}

export async function invalidateContractMonthLaborCache(
  year: number,
  month: number,
): Promise<void> {
  await prisma.contractMonthLaborCache.deleteMany({ where: { year, month } });
  clearProfitabilityReportCache();
}

export async function invalidateContractMonthLaborCacheForYear(year: number): Promise<void> {
  await prisma.contractMonthLaborCache.deleteMany({ where: { year } });
  clearProfitabilityReportCache();
}

export async function invalidateContractMonthLaborCacheForDateRange(
  start: Date,
  end: Date,
): Promise<void> {
  const months = monthsOverlappingRange(start, end);
  await Promise.all(
    months.map(({ year, month }) => invalidateContractMonthLaborCache(year, month)),
  );
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  if (items.length === 0) return;
  const queue = [...items];
  const workerCount = Math.min(concurrency, queue.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item === undefined) return;
        await fn(item);
      }
    }),
  );
}

function monthsWithNominaInYear(metaRows: { fDesde: Date | null; fHasta: Date | null }[], year: number): Set<number> {
  const months = new Set<number>();
  for (const row of metaRows) {
    if (!row.fDesde || !row.fHasta) continue;
    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(year, m - 1, 1);
      const monthEnd = new Date(year, m, 0, 23, 59, 59, 999);
      if (row.fDesde <= monthEnd && row.fHasta >= monthStart) months.add(m);
    }
  }
  return months;
}

/** Nómina NAF del año desde caché Postgres; solo recalcula meses vencidos o faltantes. */
export async function getCachedNafLaborCostByContractForYear(
  year: number,
  companyCode?: string,
): Promise<{ hasNominaData: boolean; byContractMonth: Map<string, Map<number, number>> }> {
  const now = new Date();
  const lastMonth = year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth() + 1 : 0;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  const [cachedRows, metaRows] = await Promise.all([
    lastMonth > 0
      ? prisma.contractMonthLaborCache.findMany({
          where: { year, month: { lte: lastMonth } },
          select: {
            contractId: true,
            month: true,
            laborSpend: true,
            computedAt: true,
          },
        })
      : Promise.resolve([]),
    lastMonth > 0
      ? prisma.nafNominaPeriodMeta.findMany({
          where: { fDesde: { lte: yearEnd }, fHasta: { gte: yearStart } },
          select: { fDesde: true, fHasta: true },
        })
      : Promise.resolve([]),
  ]);

  const newestByMonth = new Map<number, Date>();
  const rowsByMonth = new Map<number, typeof cachedRows>();
  for (const row of cachedRows) {
    const list = rowsByMonth.get(row.month) ?? [];
    list.push(row);
    rowsByMonth.set(row.month, list);
    const prev = newestByMonth.get(row.month);
    if (!prev || row.computedAt > prev) newestByMonth.set(row.month, row.computedAt);
  }

  const nominaMonths = monthsWithNominaInYear(metaRows, year);
  const monthsToRefresh: number[] = [];
  for (let month = 1; month <= lastMonth; month++) {
    if (!nominaMonths.has(month)) continue;
    const newest = newestByMonth.get(month);
    const rows = rowsByMonth.get(month) ?? [];
    if (rows.length === 0 || !newest || !isCacheFresh(newest, year, month)) {
      monthsToRefresh.push(month);
    }
  }

  const refreshed = new Map<number, NafLaborCostMonthResult>();
  await runPool(monthsToRefresh, 3, async (month) => {
    refreshed.set(month, await refreshContractMonthLaborCache(year, month));
  });

  const byContractMonth = new Map<string, Map<number, number>>();
  const addMonth = (month: number, byContract: Map<string, number>) => {
    for (const [contractId, amount] of byContract) {
      const monthMap = byContractMonth.get(contractId) ?? new Map<number, number>();
      monthMap.set(month, amount);
      byContractMonth.set(contractId, monthMap);
    }
  };

  for (let month = 1; month <= lastMonth; month++) {
    const computed = refreshed.get(month);
    if (computed) {
      addMonth(month, computed.byContract);
      continue;
    }
    const rows = rowsByMonth.get(month) ?? [];
    for (const row of rows) {
      const monthMap = byContractMonth.get(row.contractId) ?? new Map<number, number>();
      monthMap.set(month, parseFloat(row.laborSpend.toString()));
      byContractMonth.set(row.contractId, monthMap);
    }
  }

  if (companyCode && byContractMonth.size > 0) {
    const allowed = new Set(
      (
        await prisma.contract.findMany({
          where: { id: { in: [...byContractMonth.keys()] }, company: companyCode },
          select: { id: true },
        })
      ).map((row) => row.id),
    );
    for (const contractId of [...byContractMonth.keys()]) {
      if (!allowed.has(contractId)) byContractMonth.delete(contractId);
    }
  }

  return {
    hasNominaData: nominaMonths.size > 0 || byContractMonth.size > 0,
    byContractMonth,
  };
}

export async function getCachedNafLaborCostByContractForMonth(
  year: number,
  month: number,
  companyCode?: string,
): Promise<NafLaborCostMonthResult> {
  const cachedRows = await prisma.contractMonthLaborCache.findMany({
    where: { year, month },
    select: {
      contractId: true,
      laborSpend: true,
      cargasSocialesSpend: true,
      computedAt: true,
    },
  });

  const newestComputedAt = cachedRows.reduce<Date | null>((latest, row) => {
    if (!latest || row.computedAt > latest) return row.computedAt;
    return latest;
  }, null);

  let base: NafLaborCostMonthResult;
  if (cachedRows.length > 0 && newestComputedAt && isCacheFresh(newestComputedAt, year, month)) {
    const maps = mapsFromCacheRows(cachedRows);
    base = {
      hasNominaData: true,
      byContract: maps.byContract,
      byContractCargas: maps.byContractCargas,
    };
  } else {
    base = await refreshContractMonthLaborCache(year, month);
  }

  if (!companyCode) return base;

  const filtered = await filterLaborMapsByCompany(
    base.byContract,
    base.byContractCargas,
    companyCode,
  );
  return {
    hasNominaData: base.hasNominaData,
    byContract: filtered.byContract,
    byContractCargas: filtered.byContractCargas,
  };
}
