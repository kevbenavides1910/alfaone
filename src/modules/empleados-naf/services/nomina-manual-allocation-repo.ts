import { prisma } from "@/modules/core/db/prisma";
import {
  calendarDateKey,
  decimalToNumber,
  manualAllocationEmployeeKey,
  parsePeriodDate,
  type ManualAllocationRow,
} from "@/modules/empleados-naf/business/nomina-manual-allocation";

function mapDbManualRow(row: {
  id: string;
  contractId: string;
  devengado: { toNumber(): number };
  deducciones: { toNumber(): number };
  neto: { toNumber(): number };
  notes: string | null;
  contract: { id: string; licitacionNo: string; client: string; company: string };
}): ManualAllocationRow {
  return {
    id: row.id,
    contractId: row.contractId,
    devengado: decimalToNumber(row.devengado),
    deducciones: decimalToNumber(row.deducciones),
    neto: decimalToNumber(row.neto),
    notes: row.notes,
    contract: row.contract,
  };
}

export async function loadManualAllocationsGrouped(
  fDesde: string,
  fHasta: string,
  noCias: string[],
): Promise<Map<string, ManualAllocationRow[]>> {
  const desdeKey = calendarDateKey(parsePeriodDate(fDesde));
  const hastaKey = calendarDateKey(parsePeriodDate(fHasta));
  if (!desdeKey || !hastaKey) return new Map();

  const rows = await prisma.nafNominaManualAllocation.findMany({
    where: noCias.length > 0 ? { noCia: { in: noCias } } : undefined,
    include: {
      contract: {
        select: { id: true, licitacionNo: true, client: true, company: true },
      },
    },
    orderBy: [{ noEmple: "asc" }, { contract: { licitacionNo: "asc" } }],
  }).catch((error: unknown) => {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2021"
    ) {
      return [];
    }
    throw error;
  });

  const grouped = new Map<string, ManualAllocationRow[]>();
  for (const row of rows) {
    if (calendarDateKey(row.fDesde) !== desdeKey || calendarDateKey(row.fHasta) !== hastaKey) {
      continue;
    }
    const key = manualAllocationEmployeeKey(row.noCia, row.noEmple, row.codPla);
    const current = grouped.get(key) ?? [];
    current.push(mapDbManualRow(row));
    grouped.set(key, current);
  }

  return grouped;
}
