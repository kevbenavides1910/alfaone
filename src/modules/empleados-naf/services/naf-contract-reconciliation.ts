import { prisma } from "@/modules/core/db/prisma";
import {
  buildSapToCompanyMap,
  companySapLabel,
  resolveCompanyFromSapCode,
} from "@/modules/empleados/business/company-sap";
import {
  normalizeRrhhContrato,
  rankContractCandidates,
} from "@/modules/empleados/business/contract-match";
import { nafEmployeeSourceKey } from "@/modules/empleados-naf/business/employee-key";
import {
  applyPeerHint,
  buildNominaContractContext,
  buildPeerContractHints,
  resolveNominaContract,
} from "@/modules/empleados-naf/services/nomina-contract-resolve";
import { normalizeLicitacionNo } from "@/modules/presupuestos/import/expense-rows";

export type NafContractDiscrepancyStatus =
  | "sin_vinculo"
  | "coincidencia_exacta"
  | "vinculo_manual"
  | "desincronizado";

export type NafContractPlanillaRef = {
  noCia: string;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
};

export type NafContractDiscrepancyRow = {
  contratoNaf: string;
  contratoRaw: string | null;
  status: NafContractDiscrepancyStatus;
  roleCount: number;
  employeeCount: number;
  nominaLineCount: number;
  netoNomina: number;
  planillas: NafContractPlanillaRef[];
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

export type NafContractReconciliationSummary = {
  totalContratosNaf: number;
  sinVinculo: number;
  coincidenciaExactaPendiente: number;
  vinculadosManual: number;
  desincronizados: number;
  netoSinVinculo: number;
};

export type NafContractReconciliationPeriodo = {
  ano: number;
  fDesde: string;
  fHasta: string;
  label: string;
  empleados: number;
  empresas: number;
};

export type NafContractReconciliationResult = {
  periodo: NafContractReconciliationPeriodo | null;
  summary: NafContractReconciliationSummary;
  discrepancies: NafContractDiscrepancyRow[];
  contracts: { id: string; licitacionNo: string; client: string; company: string; status: string }[];
};

type PeriodRef = {
  noCia: string;
  ano: number;
  periodo: number;
};

type ContratoAccumulator = {
  contratoNaf: string;
  contratoRaw: string | null;
  employeeIds: Set<string>;
  nominaLineCount: number;
  netoNomina: number;
  planillas: Map<string, NafContractPlanillaRef>;
};

function calendarDateKey(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const year = value.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function formatCalendarDate(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const year = value.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function buildContractMaps(
  contracts: { id: string; licitacionNo: string; client: string; company: string }[],
) {
  const byLicitacion = new Map<
    string,
    { id: string; licitacionNo: string; client: string; company: string }
  >();
  for (const contract of contracts) {
    const key = normalizeLicitacionNo(contract.licitacionNo);
    byLicitacion.set(key, contract);
    byLicitacion.set(contract.licitacionNo.trim(), contract);
  }
  return byLicitacion;
}

function planillaKey(noCia: string, codPla: string) {
  return `${noCia}|${codPla}`;
}

function emptyResult(
  contracts: NafContractReconciliationResult["contracts"],
): NafContractReconciliationResult {
  return {
    periodo: null,
    summary: {
      totalContratosNaf: 0,
      sinVinculo: 0,
      coincidenciaExactaPendiente: 0,
      vinculadosManual: 0,
      desincronizados: 0,
      netoSinVinculo: 0,
    },
    discrepancies: [],
    contracts,
  };
}

async function resolveLatestNominaPeriod(): Promise<{
  ano: number;
  fDesde: Date;
  fHasta: Date;
  refs: PeriodRef[];
} | null> {
  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: { fDesde: { not: null }, fHasta: { not: null } },
    select: { noCia: true, ano: true, periodo: true, fDesde: true, fHasta: true },
    orderBy: [{ fHasta: "desc" }, { ano: "desc" }],
  });

  if (metaRows.length === 0) return null;

  const latest = metaRows[0];
  if (!latest.fDesde || !latest.fHasta) return null;

  const desdeKey = calendarDateKey(latest.fDesde);
  const hastaKey = calendarDateKey(latest.fHasta);

  const refs: PeriodRef[] = [];
  const seen = new Set<string>();
  for (const row of metaRows) {
    if (!row.fDesde || !row.fHasta) continue;
    if (calendarDateKey(row.fDesde) !== desdeKey || calendarDateKey(row.fHasta) !== hastaKey) {
      continue;
    }
    const key = `${row.noCia}|${row.ano}|${row.periodo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ noCia: row.noCia, ano: row.ano, periodo: row.periodo });
  }

  if (refs.length === 0) return null;

  return {
    ano: latest.ano,
    fDesde: latest.fDesde,
    fHasta: latest.fHasta,
    refs,
  };
}

function upsertContratoFromNomina(
  map: Map<string, ContratoAccumulator>,
  contratoRaw: string | null | undefined,
  patch: {
    sourceKey: string;
    neto: number;
    planilla?: NafContractPlanillaRef;
  },
) {
  const normalized = normalizeRrhhContrato(contratoRaw ?? "");
  if (!normalized) return;

  const current = map.get(normalized) ?? {
    contratoNaf: normalized,
    contratoRaw: contratoRaw?.trim() || null,
    employeeIds: new Set<string>(),
    nominaLineCount: 0,
    netoNomina: 0,
    planillas: new Map<string, NafContractPlanillaRef>(),
  };

  if (!current.contratoRaw && contratoRaw?.trim()) {
    current.contratoRaw = contratoRaw.trim();
  }
  current.employeeIds.add(patch.sourceKey);
  current.nominaLineCount += 1;
  current.netoNomina += patch.neto;
  if (patch.planilla) {
    current.planillas.set(planillaKey(patch.planilla.noCia, patch.planilla.codPla), patch.planilla);
  }

  map.set(normalized, current);
}

export async function getNafContractReconciliation(): Promise<NafContractReconciliationResult> {
  const [contracts, links, companies, latestPeriod, contractCtx] = await Promise.all([
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
    prisma.company.findMany({
      where: { isActive: true },
      select: { code: true, name: true, sapCode: true },
    }),
    resolveLatestNominaPeriod(),
    buildNominaContractContext(),
  ]);

  if (!latestPeriod) {
    return emptyResult(contracts);
  }

  const sapToCompany = buildSapToCompanyMap(companies);
  const companyLabel = (noCia: string) => {
    const { sapCode, companyCode } = resolveCompanyFromSapCode(noCia, sapToCompany);
    const company = companies.find((c) => c.code === companyCode);
    return companySapLabel(sapCode, companyCode, company?.name ?? null);
  };

  const summaries = await prisma.nafNominaSummary.findMany({
    where: {
      OR: latestPeriod.refs.map((ref) => ({
        noCia: ref.noCia,
        ano: ref.ano,
        periodo: ref.periodo,
      })),
    },
    select: {
      noCia: true,
      noEmple: true,
      codPla: true,
      nominaNombre: true,
      neto: true,
    },
  });

  if (summaries.length === 0) {
    return emptyResult(contracts);
  }

  const employeeKeys = summaries.map((row) => nafEmployeeSourceKey(row.noCia, row.noEmple));
  const employees = await prisma.nafEmployee.findMany({
    where: { sourceKey: { in: employeeKeys } },
    select: {
      sourceKey: true,
      cedula: true,
      contrato: true,
      noRol: true,
      ubicacionCode: true,
      zona: true,
    },
  });
  const employeeByKey = new Map(employees.map((employee) => [employee.sourceKey, employee]));

  const pendingRows = summaries.map((summary) => {
    const sourceKey = nafEmployeeSourceKey(summary.noCia, summary.noEmple);
    const employee = employeeByKey.get(sourceKey);
    const resolved = resolveNominaContract(
      {
        cedula: employee?.cedula ?? null,
        noRol: employee?.noRol ?? null,
        contrato: employee?.contrato ?? null,
        ubicacionCode: employee?.ubicacionCode ?? null,
        zona: employee?.zona ?? null,
      },
      summary.noCia,
      summary.noEmple,
      summary.codPla,
      contractCtx,
    );
    return { summary, employee, resolved };
  });

  const peerHints = buildPeerContractHints(
    pendingRows.map((row) => ({
      noCia: row.summary.noCia,
      codPla: row.summary.codPla,
      zona: row.employee?.zona ?? null,
      resolved: row.resolved,
    })),
  );

  const contratos = new Map<string, ContratoAccumulator>();
  const activeEmployeeIds = new Set<string>();

  for (const { summary, employee, resolved: initialResolved } of pendingRows) {
    const sourceKey = nafEmployeeSourceKey(summary.noCia, summary.noEmple);
    activeEmployeeIds.add(sourceKey);

    const resolved = applyPeerHint(
      initialResolved,
      summary.noCia,
      summary.codPla,
      employee?.zona ?? null,
      peerHints,
      contractCtx,
    );

    const contratoRaw = resolved.contratoRrhh;
    if (!contratoRaw) continue;

    upsertContratoFromNomina(contratos, contratoRaw, {
      sourceKey,
      neto: Number(summary.neto),
      planilla: {
        noCia: summary.noCia,
        companyLabel: companyLabel(summary.noCia),
        codPla: summary.codPla,
        nominaNombre: summary.nominaNombre,
      },
    });
  }

  const linkByContrato = new Map(links.map((link) => [link.contratoRrhh, link]));
  const contractByLicitacion = buildContractMaps(contracts);
  const discrepancies: NafContractDiscrepancyRow[] = [];

  for (const acc of contratos.values()) {
    const exact = contractByLicitacion.get(acc.contratoNaf) ?? null;
    const link = linkByContrato.get(acc.contratoNaf) ?? null;

    let status: NafContractDiscrepancyStatus;
    if (link) {
      if (exact && exact.id === link.contractId) continue;
      status = exact && exact.id !== link.contractId ? "desincronizado" : "vinculo_manual";
    } else if (exact) {
      status = "coincidencia_exacta";
    } else {
      status = "sin_vinculo";
    }

    discrepancies.push({
      contratoNaf: acc.contratoNaf,
      contratoRaw: acc.contratoRaw,
      status,
      roleCount: 0,
      employeeCount: acc.employeeIds.size,
      nominaLineCount: acc.nominaLineCount,
      netoNomina: acc.netoNomina,
      planillas: Array.from(acc.planillas.values()).sort((a, b) =>
        `${a.noCia}|${a.codPla}`.localeCompare(`${b.noCia}|${b.codPla}`),
      ),
      exactContractId: exact?.id ?? null,
      exactLicitacionNo: exact?.licitacionNo ?? null,
      linkedContractId: link?.contractId ?? null,
      linkedLicitacionNo: link?.contract.licitacionNo ?? null,
      suggestions: rankContractCandidates(acc.contratoNaf, contracts),
    });
  }

  discrepancies.sort((a, b) => {
    const order: Record<NafContractDiscrepancyStatus, number> = {
      sin_vinculo: 0,
      desincronizado: 1,
      coincidencia_exacta: 2,
      vinculo_manual: 3,
    };
    const delta = order[a.status] - order[b.status];
    if (delta !== 0) return delta;
    return b.netoNomina - a.netoNomina;
  });

  const periodo: NafContractReconciliationPeriodo = {
    ano: latestPeriod.ano,
    fDesde: latestPeriod.fDesde.toISOString(),
    fHasta: latestPeriod.fHasta.toISOString(),
    label: `${formatCalendarDate(latestPeriod.fDesde)} – ${formatCalendarDate(latestPeriod.fHasta)}`,
    empleados: activeEmployeeIds.size,
    empresas: new Set(latestPeriod.refs.map((ref) => ref.noCia)).size,
  };

  const summary: NafContractReconciliationSummary = {
    totalContratosNaf: contratos.size,
    sinVinculo: discrepancies.filter((row) => row.status === "sin_vinculo").length,
    coincidenciaExactaPendiente: discrepancies.filter((row) => row.status === "coincidencia_exacta")
      .length,
    vinculadosManual: discrepancies.filter((row) => row.status === "vinculo_manual").length,
    desincronizados: discrepancies.filter((row) => row.status === "desincronizado").length,
    netoSinVinculo: discrepancies
      .filter((row) => row.status === "sin_vinculo")
      .reduce((sum, row) => sum + row.netoNomina, 0),
  };

  return { periodo, summary, discrepancies, contracts };
}

export async function applyNafExactContractMatches(): Promise<{
  linksCreated: number;
}> {
  const { discrepancies } = await getNafContractReconciliation();
  const exact = discrepancies.filter(
    (row) => row.status === "coincidencia_exacta" && row.exactContractId,
  );

  let linksCreated = 0;
  for (const row of exact) {
    await prisma.employeeContractLink.upsert({
      where: { contratoRrhh: row.contratoNaf },
      create: {
        contratoRrhh: row.contratoNaf,
        contratoRaw: row.contratoRaw,
        contractId: row.exactContractId!,
        notes: "Homologación NAF: coincidencia exacta de licitación",
      },
      update: {
        contractId: row.exactContractId!,
      },
    });
    linksCreated++;
  }

  return { linksCreated };
}
