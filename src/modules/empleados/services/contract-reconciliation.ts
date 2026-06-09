import { prisma } from "@/modules/core/db/prisma";
import { normalizeLicitacionNo } from "@/modules/presupuestos/import/expense-rows";
import {
  normalizeRrhhContrato,
  rankContractCandidates,
  scoreContractMatch,
} from "@/modules/empleados/business/contract-match";

export type DiscrepancyStatus =
  | "sin_vinculo"
  | "coincidencia_exacta"
  | "vinculo_manual"
  | "desincronizado";

export type ContractDiscrepancyRow = {
  contratoRrhh: string;
  contratoRaw: string | null;
  status: DiscrepancyStatus;
  placementCount: number;
  employeeCount: number;
  exactContractId: string | null;
  exactLicitacionNo: string | null;
  linkedContractId: string | null;
  linkedLicitacionNo: string | null;
  suggestions: {
    contractId: string;
    licitacionNo: string;
    client: string;
    company: string;
    score: number;
  }[];
};

export type ContractWithoutEmployeesRow = {
  contractId: string;
  licitacionNo: string;
  client: string;
  company: string;
  status: string;
};

export type ContractReconciliationSummary = {
  totalRrhhContratos: number;
  sinVinculo: number;
  coincidenciaExactaPendiente: number;
  vinculadosManual: number;
  desincronizados: number;
  contratosSinEmpleados: number;
};

export type ContractReconciliationResult = {
  summary: ContractReconciliationSummary;
  discrepancies: ContractDiscrepancyRow[];
  contractsWithoutEmployees: ContractWithoutEmployeesRow[];
  contracts: { id: string; licitacionNo: string; client: string; company: string; status: string }[];
};

function buildContractMaps(contracts: {
  id: string;
  licitacionNo: string;
  client: string;
  company: string;
}[]) {
  const byLicitacion = new Map<
    string,
    { id: string; licitacionNo: string; client: string; company: string }
  >();
  for (const c of contracts) {
    const key = normalizeLicitacionNo(c.licitacionNo);
    byLicitacion.set(key, c);
    byLicitacion.set(c.licitacionNo.trim(), c);
  }
  return byLicitacion;
}

export async function getContractReconciliation(): Promise<ContractReconciliationResult> {
  const [contracts, links, placementGroups] = await Promise.all([
    prisma.contract.findMany({
      where: { deletedAt: null },
      select: { id: true, licitacionNo: true, client: true, company: true, status: true },
      orderBy: { licitacionNo: "asc" },
    }),
    prisma.employeeContractLink.findMany({
      include: {
        contract: { select: { id: true, licitacionNo: true, client: true, company: true } },
      },
    }),
    prisma.employeePlacement.groupBy({
      by: ["contratoNormalizado", "contrato"],
      where: {
        contratoNormalizado: { not: null },
        NOT: { contratoNormalizado: "" },
      },
      _count: { _all: true },
    }),
  ]);

  const linkByRrhh = new Map(links.map((l) => [l.contratoRrhh, l]));
  const contractByLicitacion = buildContractMaps(contracts);

  const employeeCountsRaw = await prisma.$queryRaw<{ contratoNormalizado: string; count: bigint }[]>`
    SELECT "contratoNormalizado", COUNT(DISTINCT "employeeId")::bigint AS count
    FROM employee_placements
    WHERE "contratoNormalizado" IS NOT NULL AND "contratoNormalizado" <> ''
    GROUP BY "contratoNormalizado"
  `;
  const employeesByContrato = new Map(
    employeeCountsRaw.map((r) => [r.contratoNormalizado, Number(r.count)]),
  );

  const unlinkedByContrato = await prisma.$queryRaw<{ contratoNormalizado: string; count: bigint }[]>`
    SELECT "contratoNormalizado", COUNT(*)::bigint AS count
    FROM employee_placements
    WHERE "contratoNormalizado" IS NOT NULL AND "contratoNormalizado" <> '' AND "contractId" IS NULL
    GROUP BY "contratoNormalizado"
  `;
  const unlinkedPlacementsByContrato = new Map(
    unlinkedByContrato.map((r) => [r.contratoNormalizado, Number(r.count)]),
  );

  const linkedContractIds = new Set<string>(
    (
      await prisma.employeePlacement.findMany({
        where: { contractId: { not: null } },
        select: { contractId: true },
        distinct: ["contractId"],
      })
    ).map((p) => p.contractId as string),
  );
  for (const link of links) linkedContractIds.add(link.contractId);
  const rrhhKeysSeen = new Set<string>();

  const discrepancies: ContractDiscrepancyRow[] = [];

  for (const g of placementGroups) {
    const contratoRrhh = g.contratoNormalizado ?? "";
    if (!contratoRrhh) continue;
    rrhhKeysSeen.add(contratoRrhh);

    const exact = contractByLicitacion.get(contratoRrhh) ?? null;
    const link = linkByRrhh.get(contratoRrhh) ?? null;
    if (link) linkedContractIds.add(link.contractId);
    if (exact) linkedContractIds.add(exact.id);

    const unlinkedPlacements = unlinkedPlacementsByContrato.get(contratoRrhh) ?? 0;

    let status: DiscrepancyStatus;
    if (link) {
      if (exact && exact.id !== link.contractId) {
        status = "desincronizado";
      } else if (unlinkedPlacements === 0) {
        continue;
      } else {
        status = "vinculo_manual";
      }
    } else if (exact) {
      status = "coincidencia_exacta";
    } else {
      status = "sin_vinculo";
    }

    discrepancies.push({
      contratoRrhh,
      contratoRaw: g.contrato,
      status,
      placementCount: g._count._all,
      employeeCount: employeesByContrato.get(contratoRrhh) ?? 0,
      exactContractId: exact?.id ?? null,
      exactLicitacionNo: exact?.licitacionNo ?? null,
      linkedContractId: link?.contractId ?? null,
      linkedLicitacionNo: link?.contract.licitacionNo ?? null,
      suggestions: rankContractCandidates(contratoRrhh, contracts),
    });
  }

  discrepancies.sort((a, b) => {
    const order: Record<DiscrepancyStatus, number> = {
      sin_vinculo: 0,
      desincronizado: 1,
      coincidencia_exacta: 2,
      vinculo_manual: 3,
    };
    const d = order[a.status] - order[b.status];
    if (d !== 0) return d;
    return b.placementCount - a.placementCount;
  });

  const contractsWithoutEmployees: ContractWithoutEmployeesRow[] = contracts
    .filter((c) => !linkedContractIds.has(c.id))
    .map((c) => ({
      contractId: c.id,
      licitacionNo: c.licitacionNo,
      client: c.client,
      company: c.company,
      status: c.status,
    }));

  const summary: ContractReconciliationSummary = {
    totalRrhhContratos: rrhhKeysSeen.size,
    sinVinculo: discrepancies.filter((d) => d.status === "sin_vinculo").length,
    coincidenciaExactaPendiente: discrepancies.filter((d) => d.status === "coincidencia_exacta")
      .length,
    vinculadosManual: links.length,
    desincronizados: discrepancies.filter((d) => d.status === "desincronizado").length,
    contratosSinEmpleados: contractsWithoutEmployees.length,
  };

  return { summary, discrepancies, contractsWithoutEmployees, contracts };
}

export async function applyPlacementsContractId(
  contratoRrhh: string,
  contractId: string,
): Promise<number> {
  const result = await prisma.employeePlacement.updateMany({
    where: { contratoNormalizado: contratoRrhh },
    data: { contractId },
  });
  return result.count;
}

export async function linkRrhhContratoToContract(
  contratoRaw: string,
  contractId: string,
  userId: string,
  notes?: string,
): Promise<{ placementsUpdated: number; linkId: string }> {
  const contratoRrhh = normalizeRrhhContrato(contratoRaw);
  if (!contratoRrhh) throw new Error("Número de contrato RRHH inválido");

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
    select: { id: true },
  });
  if (!contract) throw new Error("Contrato no encontrado");

  const link = await prisma.employeeContractLink.upsert({
    where: { contratoRrhh },
    create: {
      contratoRrhh,
      contratoRaw: contratoRaw.trim() || null,
      contractId,
      createdById: userId,
      notes: notes?.trim() || null,
    },
    update: {
      contratoRaw: contratoRaw.trim() || undefined,
      contractId,
      notes: notes?.trim() || undefined,
    },
  });

  const placementsUpdated = await applyPlacementsContractId(contratoRrhh, contractId);
  return { placementsUpdated, linkId: link.id };
}

export async function applyAllExactMatches(): Promise<{
  linksCreated: number;
  placementsUpdated: number;
}> {
  const { discrepancies } = await getContractReconciliation();
  const exact = discrepancies.filter((d) => d.status === "coincidencia_exacta" && d.exactContractId);

  let linksCreated = 0;
  let placementsUpdated = 0;

  for (const row of exact) {
    await prisma.employeeContractLink.upsert({
      where: { contratoRrhh: row.contratoRrhh },
      create: {
        contratoRrhh: row.contratoRrhh,
        contratoRaw: row.contratoRaw,
        contractId: row.exactContractId!,
        notes: "Vinculación automática por coincidencia exacta de licitación",
      },
      update: {
        contractId: row.exactContractId!,
      },
    });
    linksCreated++;
    placementsUpdated += await applyPlacementsContractId(row.contratoRrhh, row.exactContractId!);
  }

  return { linksCreated, placementsUpdated };
}

/**
 * Unifica el número de licitación del contrato del sistema con el del RRHH
 * y vincula todas las asignaciones de empleados.
 */
export async function consolidateContractLicitacion(
  contratoRaw: string,
  contractId: string,
  userId: string,
): Promise<{ placementsUpdated: number; newLicitacionNo: string }> {
  const contratoRrhh = normalizeRrhhContrato(contratoRaw);
  if (!contratoRrhh) throw new Error("Número de contrato RRHH inválido");

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
    select: { id: true, licitacionNo: true },
  });
  if (!contract) throw new Error("Contrato no encontrado");

  if (normalizeLicitacionNo(contract.licitacionNo) !== contratoRrhh) {
    const conflict = await prisma.contract.findFirst({
      where: {
        licitacionNo: contratoRrhh,
        deletedAt: null,
        NOT: { id: contractId },
      },
      select: { id: true, licitacionNo: true },
    });
    if (conflict) {
      throw new Error(
        `Ya existe otro contrato con licitación «${conflict.licitacionNo}». Vincule sin unificar o elimine el duplicado.`,
      );
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: { licitacionNo: contratoRrhh },
    });
  }

  const { placementsUpdated } = await linkRrhhContratoToContract(
    contratoRaw,
    contractId,
    userId,
    "Licitación unificada con número RRHH",
  );

  return { placementsUpdated, newLicitacionNo: contratoRrhh };
}

export async function resolveContractIdForRrhh(
  contratoRaw: string | null,
  contractIdByLicitacion: Map<string, string>,
  linkByRrhh: Map<string, string>,
): Promise<string | null> {
  const contratoRrhh = normalizeRrhhContrato(contratoRaw);
  if (!contratoRrhh) return null;
  return (
    linkByRrhh.get(contratoRrhh) ??
    contractIdByLicitacion.get(contratoRrhh) ??
    null
  );
}

export { scoreContractMatch };
