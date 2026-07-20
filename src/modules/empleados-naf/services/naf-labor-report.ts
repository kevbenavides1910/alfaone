import { prisma } from "@/modules/core/db/prisma";
import { normalizeSapCode } from "@/modules/empleados/business/company-sap";
import { getNafNominaByDateRange } from "@/modules/empleados-naf/services/list-nomina";
import { buildNominaContractContext } from "@/modules/empleados-naf/services/nomina-contract-resolve";
import { loadNafCargasSocialesPctByNoCia } from "@/modules/empleados-naf/services/cargas-sociales";
import type { CargasSocialesMontos } from "@/modules/empleados-naf/business/cargas-sociales-calc";
import type { NafAsistenciaContratoAsignado } from "@/modules/empleados-naf/business/nomina-asistencia-format";
import { asistenciaAllocationWeight } from "@/modules/empleados-naf/business/nomina-asistencia-hours";
import { isNafEmployeeExcludedFromRubros } from "@/modules/presupuestos/business/naf-labor-rubro";

type NominaPeriodRange = {
  fDesde: string;
  fHasta: string;
  noCias: string[];
};

export type NafLaborCostMonthResult = {
  /** true si hubo al menos un periodo de nómina NAF en el mes calendario */
  hasNominaData: boolean;
  byContract: Map<string, number>;
  /** Porción de cargas sociales del gasto MO NAF por contrato. */
  byContractCargas: Map<string, number>;
};


async function resolveNoCiaFilter(companyCode?: string): Promise<string[] | undefined> {
  if (!companyCode) return undefined;
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { code: true, sapCode: true },
  });
  const company = companies.find((row) => row.code === companyCode);
  // Empresas sin SAP (p. ej. GRUPO / DA-Administrativo) agrupan personal de varias
  // compañías NAF: no filtrar por noCia; el vínculo se hace por contractId.
  if (!company?.sapCode) return undefined;
  const sap = normalizeSapCode(company.sapCode);
  return sap ? [sap] : undefined;
}

async function findOverlappingNominaPeriods(
  monthStart: Date,
  monthEnd: Date,
  companyCode?: string,
): Promise<NominaPeriodRange[]> {
  const noCiaFilter = await resolveNoCiaFilter(companyCode);
  if (noCiaFilter && noCiaFilter.length === 0) return [];

  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: {
      fDesde: { lte: monthEnd },
      fHasta: { gte: monthStart },
      ...(noCiaFilter ? { noCia: { in: noCiaFilter } } : {}),
    },
    select: { noCia: true, fDesde: true, fHasta: true },
  });

  const grouped = new Map<string, NominaPeriodRange>();
  for (const row of metaRows) {
    if (!row.fDesde || !row.fHasta) continue;
    const fDesde = row.fDesde.toISOString();
    const fHasta = row.fHasta.toISOString();
    const key = `${fDesde}|${fHasta}`;
    const noCia = normalizeSapCode(row.noCia) ?? row.noCia;
    const current = grouped.get(key) ?? { fDesde, fHasta, noCias: [] };
    if (!current.noCias.includes(noCia)) current.noCias.push(noCia);
    grouped.set(key, current);
  }

  return [...grouped.values()].filter((range) => range.noCias.length > 0);
}

type NafLaborEmpleadoContratoRow = {
  contractId: string | null;
  brutoConCargasSociales?: number;
  cargasSocialesMonto?: number;
  devengado?: number;
};

type NafLaborEmpleadoRow = {
  noCia: string;
  codPla: string;
  contratosAsistencia: NafLaborEmpleadoContratoRow[];
};

/** Suma bruto+cargas por contrato omitiendo empresas/tipos de planilla excluidos (noCia 08/09, etc.). */
function addContractLaborTotalsFromEmpleados(
  target: Map<string, number>,
  empleados: NafLaborEmpleadoRow[],
  cargasTarget?: Map<string, number>,
) {
  for (const empleado of empleados) {
    if (isNafEmployeeExcludedFromRubros(empleado.noCia, empleado.codPla)) continue;
    for (const contrato of empleado.contratosAsistencia) {
      if (!contrato.contractId) continue;
      const amount = contrato.brutoConCargasSociales ?? contrato.devengado ?? 0;
      if (amount <= 0) continue;
      target.set(contrato.contractId, (target.get(contrato.contractId) ?? 0) + amount);
      if (cargasTarget) {
        const cargas = contrato.cargasSocialesMonto ?? 0;
        if (cargas > 0) {
          cargasTarget.set(
            contrato.contractId,
            (cargasTarget.get(contrato.contractId) ?? 0) + cargas,
          );
        }
      }
    }
  }
}

function addContractLaborTotalsToMonth(
  byContractMonth: Map<string, Map<number, number>>,
  month: number,
  empleados: NafLaborEmpleadoRow[],
) {
  for (const empleado of empleados) {
    if (isNafEmployeeExcludedFromRubros(empleado.noCia, empleado.codPla)) continue;
    for (const contrato of empleado.contratosAsistencia) {
      if (!contrato.contractId) continue;
      const amount = contrato.brutoConCargasSociales ?? contrato.devengado ?? 0;
      if (amount <= 0) continue;
      const monthMap = byContractMonth.get(contrato.contractId) ?? new Map<number, number>();
      monthMap.set(month, (monthMap.get(month) ?? 0) + amount);
      byContractMonth.set(contrato.contractId, monthMap);
    }
  }
}

function monthsOverlappingYearRange(year: number, fDesde: string, fHasta: string): number[] {
  const desde = new Date(fDesde);
  const hasta = new Date(fHasta);
  const months: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthStart = new Date(year, m - 1, 1);
    const monthEnd = new Date(year, m, 0, 23, 59, 59, 999);
    if (desde <= monthEnd && hasta >= monthStart) months.push(m);
  }
  return months;
}

/**
 * Bruto + cargas sociales por contrato del sistema para un mes calendario,
 * sumando las quincenas NAF cuyo rango cae en ese mes (sin caché Postgres).
 */
export async function computeNafLaborCostByContractForMonth(
  year: number,
  month: number,
  companyCode?: string,
): Promise<NafLaborCostMonthResult> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const periodRanges = await findOverlappingNominaPeriods(monthStart, monthEnd, companyCode);

  const byContract = new Map<string, number>();
  const byContractCargas = new Map<string, number>();
  if (periodRanges.length === 0) {
    return { hasNominaData: false, byContract, byContractCargas };
  }

  const allNoCias = [...new Set(periodRanges.flatMap((range) => range.noCias))];
  const [contractCtx, pctByNoCia] = await Promise.all([
    buildNominaContractContext(),
    loadNafCargasSocialesPctByNoCia(allNoCias),
  ]);
  const nominaOptions = {
    allowUnresolvedContracts: true as const,
    contractCtx,
    cargasPctByNoCia: pctByNoCia,
    laborAllocationOnly: true as const,
  };

  for (const range of periodRanges) {
    try {
      const detalle = await getNafNominaByDateRange(
        range.fDesde,
        range.fHasta,
        range.noCias,
        undefined,
        nominaOptions,
      );
      addContractLaborTotalsFromEmpleados(byContract, detalle.empleados, byContractCargas);
    } catch (error) {
      console.warn(
        `[naf-labor-report] periodo omitido ${range.fDesde}–${range.fHasta} (${range.noCias.join(",")}):`,
        error,
      );
    }
  }

  return { hasNominaData: true, byContract, byContractCargas };
}

/**
 * Bruto + cargas sociales por contrato del sistema para un mes calendario,
 * sumando las quincenas NAF cuyo rango cae en ese mes.
 */
export async function getNafLaborCostByContractForMonth(
  year: number,
  month: number,
  companyCode?: string,
): Promise<NafLaborCostMonthResult> {
  const { getCachedNafLaborCostByContractForMonth } = await import(
    "@/modules/empleados-naf/services/contract-month-labor-cache"
  );
  return getCachedNafLaborCostByContractForMonth(year, month, companyCode);
}

/** Mapa contractId → mes (1-12) → bruto + cargas sociales */
export async function getNafLaborCostByContractForYear(
  year: number,
  companyCode?: string,
): Promise<{ hasNominaData: boolean; byContractMonth: Map<string, Map<number, number>> }> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const periodRanges = await findOverlappingNominaPeriods(yearStart, yearEnd, companyCode);

  const byContractMonth = new Map<string, Map<number, number>>();
  if (periodRanges.length === 0) {
    return { hasNominaData: false, byContractMonth };
  }

  const allNoCias = [...new Set(periodRanges.flatMap((range) => range.noCias))];
  const [contractCtx, pctByNoCia] = await Promise.all([
    buildNominaContractContext(),
    loadNafCargasSocialesPctByNoCia(allNoCias),
  ]);
  const nominaOptions = {
    allowUnresolvedContracts: true as const,
    contractCtx,
    cargasPctByNoCia: pctByNoCia,
  };

  for (const range of periodRanges) {
    const overlappingMonths = monthsOverlappingYearRange(year, range.fDesde, range.fHasta);
    try {
      const detalle = await getNafNominaByDateRange(
        range.fDesde,
        range.fHasta,
        range.noCias,
        undefined,
        nominaOptions,
      );
      for (const month of overlappingMonths) {
        addContractLaborTotalsToMonth(byContractMonth, month, detalle.empleados);
      }
    } catch (error) {
      console.warn(
        `[naf-labor-report] periodo omitido ${range.fDesde}–${range.fHasta} (${range.noCias.join(",")}):`,
        error,
      );
    }
  }

  return { hasNominaData: true, byContractMonth };
}

export type NafLaborEmployeeBreakdownContrato = {
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  noContrato: string;
  marcas: number;
  horas: number;
  pagoRol: number;
  participacion: number;
  devengado: number;
  cargasSocialesMonto: number;
  brutoConCargasSociales: number;
};

export type NafLaborEmployeeBreakdownLine = {
  sourceKey: string;
  noEmple: string;
  nombre: string | null;
  codPla: string;
  nominaNombre: string | null;
  devengado: number;
  cargasSocialesMonto: number;
  brutoConCargasSociales: number;
  contratos: NafLaborEmployeeBreakdownContrato[];
};

function contratoAggKey(contrato: {
  contractId: string | null;
  noContrato: string;
  contratoNormalizado?: string | null;
}): string {
  return contrato.contractId ?? contrato.contratoNormalizado ?? contrato.noContrato;
}

type EmployeeAgg = {
  sourceKey: string;
  noEmple: string;
  nombre: string | null;
  codPla: string;
  nominaNombre: string | null;
  contratos: Map<string, NafLaborEmployeeBreakdownContrato>;
};

async function aggregateNafLaborEmployeesForMonth(
  year: number,
  month: number,
  companyCode?: string,
): Promise<{ hasNominaData: boolean; employees: Map<string, EmployeeAgg> }> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const periodRanges = await findOverlappingNominaPeriods(monthStart, monthEnd, companyCode);

  if (periodRanges.length === 0) {
    return { hasNominaData: false, employees: new Map() };
  }

  const allNoCias = [...new Set(periodRanges.flatMap((range) => range.noCias))];
  const [contractCtx, pctByNoCia] = await Promise.all([
    buildNominaContractContext(),
    loadNafCargasSocialesPctByNoCia(allNoCias),
  ]);
  const nominaOptions = {
    allowUnresolvedContracts: true as const,
    contractCtx,
    cargasPctByNoCia: pctByNoCia,
    laborAllocationOnly: true as const,
  };

  const aggregated = new Map<string, EmployeeAgg>();

  for (const range of periodRanges) {
    try {
      const detalle = await getNafNominaByDateRange(
        range.fDesde,
        range.fHasta,
        range.noCias,
        undefined,
        nominaOptions,
      );

      for (const empleado of detalle.empleados) {
        if (isNafEmployeeExcludedFromRubros(empleado.noCia, empleado.codPla)) continue;
        for (const contrato of empleado.contratosAsistencia) {
          const enriched = contrato as NafAsistenciaContratoAsignado & CargasSocialesMontos;
          const amount = enriched.brutoConCargasSociales ?? contrato.devengado;
          if (amount <= 0) continue;

          const employee =
            aggregated.get(empleado.sourceKey) ??
            ({
              sourceKey: empleado.sourceKey,
              noEmple: empleado.noEmple,
              nombre: empleado.nombre,
              codPla: empleado.codPla,
              nominaNombre: empleado.nominaNombre,
              contratos: new Map<string, NafLaborEmployeeBreakdownContrato>(),
            } satisfies EmployeeAgg);

          const key = contratoAggKey(contrato);
          const current = employee.contratos.get(key) ?? {
            contractId: contrato.contractId,
            licitacionNo: contrato.licitacionNo,
            client: contrato.client,
            noContrato: contrato.noContrato,
            marcas: 0,
            horas: 0,
            pagoRol: 0,
            participacion: 0,
            devengado: 0,
            cargasSocialesMonto: 0,
            brutoConCargasSociales: 0,
          };

          current.marcas += contrato.marcas || contrato.dias;
          current.horas += contrato.horas || 0;
          current.pagoRol += contrato.pagoRol || 0;
          current.devengado += contrato.devengado;
          current.cargasSocialesMonto += enriched.cargasSocialesMonto ?? 0;
          current.brutoConCargasSociales += amount;
          employee.contratos.set(key, current);
          aggregated.set(empleado.sourceKey, employee);
        }
      }
    } catch (error) {
      console.warn(
        `[naf-labor-report] desglose empleados omitido ${range.fDesde}–${range.fHasta}:`,
        error,
      );
    }
  }

  return { hasNominaData: true, employees: aggregated };
}

function finalizeEmployeeAgg(emp: EmployeeAgg): NafLaborEmployeeBreakdownLine {
  const contratos = [...emp.contratos.values()].sort(
    (a, b) => b.brutoConCargasSociales - a.brutoConCargasSociales,
  );
  const devengado = contratos.reduce((sum, row) => sum + row.devengado, 0);
  const cargasSocialesMonto = contratos.reduce((sum, row) => sum + row.cargasSocialesMonto, 0);
  const brutoConCargasSociales = contratos.reduce(
    (sum, row) => sum + row.brutoConCargasSociales,
    0,
  );
  const weightSum = contratos.reduce((sum, row) => sum + asistenciaAllocationWeight(row), 0);
  for (const row of contratos) {
    row.participacion =
      weightSum > 0 ? asistenciaAllocationWeight(row) / weightSum : 1 / contratos.length;
  }
  return {
    sourceKey: emp.sourceKey,
    noEmple: emp.noEmple,
    nombre: emp.nombre,
    codPla: emp.codPla,
    nominaNombre: emp.nominaNombre,
    devengado,
    cargasSocialesMonto,
    brutoConCargasSociales,
    contratos,
  };
}

/** Todos los empleados NAF del mes (una pasada por quincena). */
export async function getNafLaborEmployeeBreakdownForMonth(
  year: number,
  month: number,
  companyCode?: string,
): Promise<{ hasNominaData: boolean; employees: NafLaborEmployeeBreakdownLine[] }> {
  const { hasNominaData, employees } = await aggregateNafLaborEmployeesForMonth(
    year,
    month,
    companyCode,
  );
  if (!hasNominaData) return { hasNominaData: false, employees: [] };
  return {
    hasNominaData: true,
    employees: [...employees.values()]
      .map(finalizeEmployeeAgg)
      .sort((a, b) => b.brutoConCargasSociales - a.brutoConCargasSociales),
  };
}

/** Empleados con salario en el contrato indicado; incluye todos sus contratos del mes. */
export async function getNafLaborEmployeeBreakdownForContractMonth(
  contractId: string,
  year: number,
  month: number,
  companyCode: string,
): Promise<{ hasNominaData: boolean; employees: NafLaborEmployeeBreakdownLine[] }> {
  const { hasNominaData, employees } = await aggregateNafLaborEmployeesForMonth(
    year,
    month,
    companyCode,
  );
  if (!hasNominaData) return { hasNominaData: false, employees: [] };

  const filtered = [...employees.values()]
    .filter((emp) => [...emp.contratos.values()].some((c) => c.contractId === contractId))
    .map(finalizeEmployeeAgg)
    .sort((a, b) => {
      const aOnContract =
        a.contratos.find((c) => c.contractId === contractId)?.brutoConCargasSociales ?? 0;
      const bOnContract =
        b.contratos.find((c) => c.contractId === contractId)?.brutoConCargasSociales ?? 0;
      return bOnContract - aOnContract;
    });

  return { hasNominaData: true, employees: filtered };
}

export function resolveNafLaborCargasForContract(
  result: NafLaborCostMonthResult,
  contractId: string,
): number {
  if (!result.hasNominaData) return 0;
  return result.byContractCargas.get(contractId) ?? 0;
}

export function resolveNafLaborSpendForContract(
  result: NafLaborCostMonthResult,
  contractId: string,
): number | undefined {
  if (!result.hasNominaData) return undefined;
  if (!result.byContract.has(contractId)) return undefined;
  return result.byContract.get(contractId);
}

export function resolveNafLaborSpendForContractMonth(
  byContractMonth: Map<string, Map<number, number>>,
  hasNominaData: boolean,
  contractId: string,
  month: number,
): number | undefined {
  if (!hasNominaData) return undefined;
  const monthMap = byContractMonth.get(contractId);
  if (!monthMap?.has(month)) return undefined;
  return monthMap.get(month);
}
