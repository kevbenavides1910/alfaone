import { prisma } from "@/modules/core/db/prisma";
import {
  buildSapToCompanyMap,
  companySapLabel,
  normalizeSapCode,
  resolveCompanyFromSapCode,
} from "@/modules/empleados/business/company-sap";
import { nafEmployeeSourceKey } from "@/modules/empleados-naf/business/employee-key";
import type { NafAsistenciaContratoAsignado } from "@/modules/empleados-naf/business/nomina-asistencia-format";
import {
  aggregateNominaByAsistenciaContrato,
  buildAsistenciaDetalleRows,
  enrichEmpleadoAsistenciaAsignada,
  type NominaAsistenciaDetalleRow,
} from "@/modules/empleados-naf/business/nomina-asistencia-allocate";
import { deriveAsistenciaDateRange, formatAsistenciaRangeLabel } from "@/modules/empleados-naf/business/nomina-asistencia-period";
import {
  asistenciaEmployeeKey,
  fetchNominaAsistenciaContratos,
  type NafAsistenciaEmpleadoResumen,
} from "@/modules/empleados-naf/services/nomina-asistencia";
import { enrichNominaDetalleWithCargasSociales } from "@/modules/empleados-naf/business/enrich-nomina-cargas-sociales";
import { applyManualAllocationsToEmpleadoRow } from "@/modules/empleados-naf/business/nomina-manual-allocation";
import { loadManualAllocationsGrouped } from "@/modules/empleados-naf/services/nomina-manual-allocation-repo";
import { loadNafCargasSocialesPctByNoCia } from "@/modules/empleados-naf/services/cargas-sociales";
import {
  applyPeerHint,
  buildNominaContractContext,
  buildPeerContractHints,
  countUnresolvedEmployees,
  resolveNominaContract,
  type NafNominaContratoResumen,
  type NominaContractContext,
  type NominaContractSource,
} from "@/modules/empleados-naf/services/nomina-contract-resolve";

export type NafNominaEmpresaOption = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
};

export type NafNominaPeriodoOption = {
  ano: number;
  fDesde: string;
  fHasta: string;
  label: string;
  descri: string | null;
  empresas: number;
};

export type NafNominaEmpresaResumen = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
  empleados: number;
  devengado: number;
  deducciones: number;
  neto: number;
};

export type NafNominaEmpleadoRow = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
  noEmple: string;
  sourceKey: string;
  nombre: string | null;
  noRol: string | null;
  contrato: string | null;
  contratoRrhh: string | null;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  contratoSource: NominaContractSource | null;
  unresolvedContract: boolean;
  codPla: string;
  nominaNombre: string | null;
  devengado: number;
  deducciones: number;
  neto: number;
  diasAsistenciaTotal: number;
  marcasAsistenciaTotal: number;
  horasAsistenciaTotal: number;
  pagoRolAsistenciaTotal: number;
  contratosAsistenciaCount: number;
  contratosAsistencia: NafAsistenciaContratoAsignado[];
};

export type NafNominaPlanillaOption = {
  noCia: string;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
  label: string;
};

export type NafNominaDetalleResult = {
  ano: number;
  fDesde: string;
  fHasta: string;
  noCias: string[];
  meta: {
    descri: string | null;
    asistenciaFDesde: string;
    asistenciaFHasta: string;
    asistenciaLabel: string;
  };
  porEmpresa: NafNominaEmpresaResumen[];
  porContrato: NafNominaContratoResumen[];
  asistenciaDetalle: NominaAsistenciaDetalleRow[];
  empleados: NafNominaEmpleadoRow[];
  totales: {
    empleados: number;
    devengado: number;
    deducciones: number;
    neto: number;
    cargasSocialesPct?: number;
    cargasSocialesMonto?: number;
    brutoConCargasSociales?: number;
  };
  contratoResumen: {
    empleadosSinContrato: number;
    netoSinContrato: number;
  };
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

function formatCalendarDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function calendarDateKey(value: Date | string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return date;
}

function normalizeNoCiaList(noCias?: string[]): string[] {
  if (!noCias?.length) return [];
  const normalized = noCias
    .map((raw) => normalizeSapCode(raw.trim()) ?? raw.trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

async function loadCompanyContext() {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { code: true, name: true, sapCode: true },
  });
  const sapToCompany = buildSapToCompanyMap(companies);
  const companyByCode = new Map(companies.map((c) => [c.code, c]));
  return { sapToCompany, companyByCode };
}

function resolveCompanyLabel(
  noCia: string,
  sapToCompany: Map<string, string>,
  companyByCode: Map<string, { code: string; name: string; sapCode: string | null }>,
): { companyCode: string | null; companyLabel: string } {
  const { sapCode, companyCode } = resolveCompanyFromSapCode(noCia, sapToCompany);
  const company = companyCode ? companyByCode.get(companyCode) : undefined;
  return {
    companyCode,
    companyLabel: companySapLabel(sapCode, companyCode, company?.name ?? null),
  };
}

export async function listNafNominaEmpresas(): Promise<NafNominaEmpresaOption[]> {
  const { sapToCompany, companyByCode } = await loadCompanyContext();
  const rows = await prisma.nafNominaSummary.findMany({
    distinct: ["noCia"],
    select: { noCia: true },
    orderBy: { noCia: "asc" },
  });

  return rows.map((row) => {
    const { companyCode, companyLabel } = resolveCompanyLabel(row.noCia, sapToCompany, companyByCode);
    return {
      noCia: row.noCia,
      companyCode,
      companyLabel,
    };
  });
}

export async function listNafNominaPeriodos(noCiasInput?: string[]): Promise<NafNominaPeriodoOption[]> {
  const noCias = normalizeNoCiaList(noCiasInput);
  if (noCias.length === 0) return [];

  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: { noCia: { in: noCias } },
    select: {
      noCia: true,
      ano: true,
      periodo: true,
      fDesde: true,
      fHasta: true,
      descri: true,
    },
    orderBy: [{ ano: "desc" }, { fDesde: "desc" }],
  });

  const grouped = new Map<
    string,
    {
      ano: number;
      fDesde: string;
      fHasta: string;
      descri: string | null;
      empresasSet: Set<string>;
      periodosSet: Set<number>;
    }
  >();

  for (const row of metaRows) {
    if (!row.fDesde || !row.fHasta) continue;
    const desdeKey = calendarDateKey(row.fDesde);
    const hastaKey = calendarDateKey(row.fHasta);
    if (!desdeKey || !hastaKey) continue;

    const key = `${row.ano}|${desdeKey}|${hastaKey}`;
    const existing = grouped.get(key);
    const empresasSet = existing?.empresasSet ?? new Set<string>();
    const periodosSet = existing?.periodosSet ?? new Set<number>();
    empresasSet.add(row.noCia);
    periodosSet.add(row.periodo);

    grouped.set(key, {
      ano: row.ano,
      fDesde: row.fDesde.toISOString(),
      fHasta: row.fHasta.toISOString(),
      descri: existing?.descri ?? row.descri ?? null,
      empresasSet,
      periodosSet,
    });
  }

  const singleCompany = noCias.length === 1;

  return Array.from(grouped.values())
    .map(({ empresasSet, periodosSet, ...row }) => {
      const desde = formatCalendarDate(row.fDesde);
      const hasta = formatCalendarDate(row.fHasta);
      const fecha = desde && hasta ? `${desde} – ${hasta}` : desde ?? hasta ?? "—";
      const scope =
        singleCompany || empresasSet.size === noCias.length
          ? ""
          : ` · ${empresasSet.size}/${noCias.length} empresas`;
      const periodoHint =
        singleCompany && periodosSet.size === 1
          ? ` · Periodo ${[...periodosSet][0]}`
          : singleCompany && periodosSet.size > 1
            ? ` · Periodos ${[...periodosSet].sort((a, b) => a - b).join(",")}`
            : "";
      const label = `${row.ano} · ${fecha}${periodoHint}${scope}`;
      return {
        ano: row.ano,
        fDesde: row.fDesde,
        fHasta: row.fHasta,
        descri: row.descri,
        empresas: empresasSet.size,
        label,
      };
    })
    .sort((a, b) => {
      if (a.ano !== b.ano) return b.ano - a.ano;
      return new Date(b.fDesde).getTime() - new Date(a.fDesde).getTime();
    });
}

export async function listNafNominaPlanillas(
  noCiasInput: string[],
  fDesde?: string,
  fHasta?: string,
): Promise<NafNominaPlanillaOption[]> {
  const noCias = normalizeNoCiaList(noCiasInput);
  if (noCias.length === 0) return [];

  const { sapToCompany, companyByCode } = await loadCompanyContext();
  const where: {
    noCia: { in: string[] };
    fDesde?: Date;
    fHasta?: Date;
  } = { noCia: { in: noCias } };

  if (fDesde && fHasta) {
    where.fDesde = parseDateInput(fDesde);
    where.fHasta = parseDateInput(fHasta);
  }

  const rows = await prisma.nafNominaPeriodMeta.findMany({
    where,
    select: {
      noCia: true,
      codPla: true,
      descri: true,
    },
    distinct: ["noCia", "codPla", "descri"],
    orderBy: [{ noCia: "asc" }, { codPla: "asc" }],
  });

  const nombreRows = await prisma.nafNominaSummary.findMany({
    where: { noCia: { in: noCias } },
    select: { noCia: true, codPla: true, nominaNombre: true },
    distinct: ["noCia", "codPla", "nominaNombre"],
  });
  const nombreByPlanilla = new Map(
    nombreRows.map((row) => [`${row.noCia}|${row.codPla}`, row.nominaNombre]),
  );

  return rows.map((row) => {
    const { companyLabel } = resolveCompanyLabel(row.noCia, sapToCompany, companyByCode);
    const nombre = nombreByPlanilla.get(`${row.noCia}|${row.codPla}`)?.trim() || row.descri?.trim() || null;
    const label = nombre
      ? `${row.codPla} · ${nombre} (${companyLabel})`
      : `${row.codPla} (${companyLabel})`;
    return {
      noCia: row.noCia,
      companyLabel,
      codPla: row.codPla,
      nominaNombre: nombre,
      label,
    };
  });
}

/**
 * Incluye codPla para no mezclar planillas que reutilizan el mismo número
 * de periodo en otros rangos de fechas de la misma compañía.
 */
type PlanillaPeriodRef = {
  noCia: string;
  codPla: string;
  ano: number;
  periodo: number;
};

async function resolvePlanillaPeriodsByDateRange(
  noCias: string[],
  fDesde: string,
  fHasta: string,
): Promise<PlanillaPeriodRef[]> {
  const desdeKey = calendarDateKey(parseDateInput(fDesde));
  const hastaKey = calendarDateKey(parseDateInput(fHasta));
  if (!desdeKey || !hastaKey) {
    throw new Error("Rango de fechas inválido");
  }

  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: { noCia: { in: noCias } },
    select: {
      noCia: true,
      codPla: true,
      ano: true,
      periodo: true,
      fDesde: true,
      fHasta: true,
    },
  });

  const refs: PlanillaPeriodRef[] = [];
  const seen = new Set<string>();

  for (const row of metaRows) {
    if (!row.fDesde || !row.fHasta) continue;
    if (calendarDateKey(row.fDesde) !== desdeKey || calendarDateKey(row.fHasta) !== hastaKey) {
      continue;
    }
    const key = `${row.noCia}|${row.codPla}|${row.ano}|${row.periodo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      noCia: row.noCia,
      codPla: row.codPla,
      ano: row.ano,
      periodo: row.periodo,
    });
  }

  return refs;
}

export async function getNafNominaByDateRange(
  fDesde: string,
  fHasta: string,
  noCiasInput: string[],
  filters?: { q?: string; codPlas?: string[] },
  options?: {
    allowUnresolvedContracts?: boolean;
    contractCtx?: NominaContractContext;
    cargasPctByNoCia?: Map<string, number>;
    skipManualApply?: boolean;
    /** Omite agregados de UI (porEmpresa, asistenciaDetalle) para cálculos MO del reporte. */
    laborAllocationOnly?: boolean;
  },
): Promise<NafNominaDetalleResult> {
  const noCias = normalizeNoCiaList(noCiasInput);
  if (noCias.length === 0) {
    throw new Error("Seleccione al menos una empresa");
  }

  const codPlas = filters?.codPlas?.map((value) => value.trim()).filter(Boolean) ?? [];
  const codPlaRefs = codPlas
    .map((value) => {
      const [noCia, codPla] = value.includes("|") ? value.split("|") : [null, value];
      if (!codPla) return null;
      return { noCia: noCia?.trim() || null, codPla: codPla.trim() };
    })
    .filter((value): value is { noCia: string | null; codPla: string } => Boolean(value));
  const codPlaRefSet =
    codPlaRefs.length > 0
      ? new Set(codPlaRefs.map((ref) => `${ref.noCia ?? "*"}|${ref.codPla}`))
      : null;

  const planillaPeriods = await resolvePlanillaPeriodsByDateRange(noCias, fDesde, fHasta);
  if (planillaPeriods.length === 0) {
    return {
      ano: new Date(fDesde).getUTCFullYear(),
      fDesde,
      fHasta,
      noCias,
      meta: { descri: null, asistenciaFDesde: "", asistenciaFHasta: "", asistenciaLabel: "" },
      porEmpresa: [],
      porContrato: [],
      asistenciaDetalle: [],
      empleados: [],
      totales: { empleados: 0, devengado: 0, deducciones: 0, neto: 0 },
      contratoResumen: { empleadosSinContrato: 0, netoSinContrato: 0 },
    };
  }

  const { sapToCompany, companyByCode } = await loadCompanyContext();
  const contractCtx = options?.contractCtx ?? (await buildNominaContractContext());

  const [summaries, metaRows] = await Promise.all([
    prisma.nafNominaSummary.findMany({
      where: {
        OR: planillaPeriods.map((ref) => ({
          noCia: ref.noCia,
          codPla: ref.codPla,
          ano: ref.ano,
          periodo: ref.periodo,
        })),
      },
      orderBy: [{ noCia: "asc" }, { neto: "desc" }, { noEmple: "asc" }],
    }),
    prisma.nafNominaPeriodMeta.findMany({
      where: {
        OR: planillaPeriods.map((ref) => ({
          noCia: ref.noCia,
          codPla: ref.codPla,
          ano: ref.ano,
          periodo: ref.periodo,
        })),
      },
      select: {
        descri: true,
      },
    }),
  ]);

  const employeeKeys = summaries.map((s) => nafEmployeeSourceKey(s.noCia, s.noEmple));
  const employees = employeeKeys.length
    ? await prisma.nafEmployee.findMany({
        where: { sourceKey: { in: employeeKeys } },
        select: {
          sourceKey: true,
          nombre: true,
          cedula: true,
          contrato: true,
          noRol: true,
          ubicacionCode: true,
          zona: true,
          nominaNombre: true,
        },
      })
    : [];
  const employeeByKey = new Map(employees.map((e) => [e.sourceKey, e]));

  const filteredSummaries = codPlaRefSet
    ? summaries.filter((summary) =>
        codPlaRefSet.has(`${summary.noCia}|${summary.codPla}`) ||
        codPlaRefSet.has(`*|${summary.codPla}`),
      )
    : summaries;

  const q = filters?.q?.trim().toLowerCase();
  type PendingRow = {
    summary: (typeof summaries)[number];
    employee: (typeof employees)[number] | undefined;
    resolvedContract: ReturnType<typeof resolveNominaContract>;
  };
  const pendingRows: PendingRow[] = [];

  for (const summary of filteredSummaries) {
    const sourceKey = nafEmployeeSourceKey(summary.noCia, summary.noEmple);
    const employee = employeeByKey.get(sourceKey);
    const resolvedContract = resolveNominaContract(
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
    pendingRows.push({ summary, employee, resolvedContract });
  }

  const peerHints = buildPeerContractHints(
    pendingRows.map((row) => ({
      noCia: row.summary.noCia,
      codPla: row.summary.codPla,
      zona: row.employee?.zona ?? null,
      resolved: row.resolvedContract,
    })),
  );

  const empresaAgg = new Map<
    string,
    NafNominaEmpresaResumen & { empleadoIds: Set<string> }
  >();
  const empleadoRows: NafNominaEmpleadoRow[] = [];

  for (const { summary, employee, resolvedContract: initialContract } of pendingRows) {
    const sourceKey = nafEmployeeSourceKey(summary.noCia, summary.noEmple);
    const resolvedContract = applyPeerHint(
      initialContract,
      summary.noCia,
      summary.codPla,
      employee?.zona ?? null,
      peerHints,
      contractCtx,
    );
    const nombre = employee?.nombre ?? null;
    const contrato = resolvedContract.contratoRrhh;
    const nominaNombre = summary.nominaNombre ?? employee?.nominaNombre ?? null;
    const devengado = decimalToNumber(summary.devengado);
    const deducciones = decimalToNumber(summary.deducciones);
    const neto = decimalToNumber(summary.neto);

    if (q) {
      const haystack = [
        summary.noEmple,
        nombre,
        contrato,
        resolvedContract.licitacionNo,
        resolvedContract.noRol,
        nominaNombre,
        summary.codPla,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    const { companyCode, companyLabel } = resolveCompanyLabel(
      summary.noCia,
      sapToCompany,
      companyByCode,
    );

    empleadoRows.push({
      noCia: summary.noCia,
      companyCode,
      companyLabel,
      noEmple: summary.noEmple,
      sourceKey,
      nombre,
      noRol: resolvedContract.noRol,
      contrato,
      contratoRrhh: resolvedContract.contratoRrhh,
      contratoNormalizado: resolvedContract.contratoNormalizado,
      contractId: resolvedContract.contractId,
      licitacionNo: resolvedContract.licitacionNo,
      client: resolvedContract.client,
      contratoSource: resolvedContract.contratoSource,
      unresolvedContract: resolvedContract.unresolved,
      codPla: summary.codPla,
      nominaNombre,
      devengado,
      deducciones,
      neto,
      contratosAsistenciaCount: 0,
      contratosAsistencia: [],
      diasAsistenciaTotal: 0,
      marcasAsistenciaTotal: 0,
      horasAsistenciaTotal: 0,
      pagoRolAsistenciaTotal: 0,
    });

    const current = empresaAgg.get(summary.noCia) ?? {
      noCia: summary.noCia,
      companyCode,
      companyLabel,
      empleados: 0,
      devengado: 0,
      deducciones: 0,
      neto: 0,
      empleadoIds: new Set<string>(),
    };
    current.empleadoIds.add(sourceKey);
    current.empleados = current.empleadoIds.size;
    current.devengado += devengado;
    current.deducciones += deducciones;
    current.neto += neto;
    empresaAgg.set(summary.noCia, current);
  }

  const porEmpresa = Array.from(empresaAgg.values())
    .map(({ empleadoIds: _empleadoIds, ...row }) => row)
    .sort((a, b) => a.noCia.localeCompare(b.noCia));

  const totales = porEmpresa.reduce(
    (acc, row) => ({
      empleados: acc.empleados + row.empleados,
      devengado: acc.devengado + row.devengado,
      deducciones: acc.deducciones + row.deducciones,
      neto: acc.neto + row.neto,
    }),
    { empleados: 0, devengado: 0, deducciones: 0, neto: 0 },
  );

  let asistenciaByEmployee = new Map<string, NafAsistenciaEmpleadoResumen>();
  try {
    asistenciaByEmployee = await fetchNominaAsistenciaContratos(
      fDesde,
      fHasta,
      noCias,
      contractCtx,
    );
  } catch {
    asistenciaByEmployee = new Map();
  }

  const empleadoRowsConAsistencia: NafNominaEmpleadoRow[] = empleadoRows.map((row) => {
    const asistencia = asistenciaByEmployee.get(asistenciaEmployeeKey(row.noCia, row.noEmple));
    const enriched = enrichEmpleadoAsistenciaAsignada({
      ...row,
      contratosAsistencia: asistencia?.contratos ?? [],
      contratosAsistenciaCount: asistencia?.contratoCount ?? 0,
    });
    return {
      ...enriched,
      contratosAsistenciaCount: asistencia?.contratoCount ?? 0,
      marcasAsistenciaTotal: enriched.marcasAsistenciaTotal,
      diasAsistenciaTotal: enriched.marcasAsistenciaTotal,
      horasAsistenciaTotal: enriched.horasAsistenciaTotal,
      pagoRolAsistenciaTotal: enriched.pagoRolAsistenciaTotal,
    };
  });

  const manualByKey = options?.skipManualApply
    ? new Map()
    : await loadManualAllocationsGrouped(fDesde, fHasta, noCias);
  const empleadoRowsFinal = empleadoRowsConAsistencia.map((row) =>
    applyManualAllocationsToEmpleadoRow(row, manualByKey),
  );

  const porContrato = options?.laborAllocationOnly
    ? []
    : aggregateNominaByAsistenciaContrato(empleadoRowsFinal);
  const asistenciaDetalle = options?.laborAllocationOnly
    ? []
    : buildAsistenciaDetalleRows(empleadoRowsFinal);
  const empleadosSinContrato = countUnresolvedEmployees(empleadoRowsFinal);
  const unresolvedRows = empleadoRowsFinal.filter(
    (row) => row.unresolvedContract || !row.contrato,
  );
  const netoSinContrato = unresolvedRows.reduce((sum, row) => sum + row.neto, 0);

  if (empleadosSinContrato > 0 && !options?.allowUnresolvedContracts) {
    throw new Error(
      `${empleadosSinContrato} empleado(s) con salario sin contrato asignado. Actualice el CSV de RRHH o sincronice roles/contratos NAF.`,
    );
  }

  const metaDescri = metaRows.map((m) => m.descri).find(Boolean) ?? null;
  const ano = planillaPeriods[0]?.ano ?? new Date(fDesde).getUTCFullYear();
  const asistenciaRange = deriveAsistenciaDateRange(fDesde, fHasta);
  const pctByNoCia =
    options?.cargasPctByNoCia ?? (await loadNafCargasSocialesPctByNoCia(noCias));

  return enrichNominaDetalleWithCargasSociales(
    {
      ano,
      fDesde,
      fHasta,
      noCias,
      meta: {
        descri: metaDescri,
        asistenciaFDesde: asistenciaRange.fDesde,
        asistenciaFHasta: asistenciaRange.fHasta,
        asistenciaLabel: formatAsistenciaRangeLabel(
          asistenciaRange.fDesde,
          asistenciaRange.fHasta,
        ),
      },
      porEmpresa,
      porContrato,
      asistenciaDetalle,
      empleados: empleadoRowsFinal,
      totales,
      contratoResumen: {
        empleadosSinContrato: options?.allowUnresolvedContracts ? empleadosSinContrato : 0,
        netoSinContrato: options?.allowUnresolvedContracts ? netoSinContrato : 0,
      },
    },
    pctByNoCia,
  );
}

/** @deprecated Usar getNafNominaByDateRange; conservado por compatibilidad interna. */
export async function getNafNominaByPeriodo(
  ano: number,
  periodo: number,
  noCiasInput: string[],
  filters?: { q?: string; codPlas?: string[] },
): Promise<NafNominaDetalleResult> {
  const noCias = normalizeNoCiaList(noCiasInput);
  if (noCias.length === 0) {
    throw new Error("Seleccione al menos una empresa");
  }

  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: {
      ano,
      periodo,
      noCia: { in: noCias },
      fDesde: { not: null },
      fHasta: { not: null },
    },
    select: {
      fDesde: true,
      fHasta: true,
    },
    take: 1,
  });

  const sample = metaRows[0];
  if (!sample?.fDesde || !sample.fHasta) {
    throw new Error("No se encontró rango de fechas para el periodo solicitado");
  }

  return getNafNominaByDateRange(
    sample.fDesde.toISOString(),
    sample.fHasta.toISOString(),
    noCias,
    filters,
  );
}

export async function countNafNominaSummaryRows() {
  return prisma.nafNominaSummary.count();
}
