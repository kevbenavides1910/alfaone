import type { NafAsistenciaContratoAsignado } from "@/modules/empleados-naf/business/nomina-asistencia-allocate";
import { splitAmount } from "@/modules/empleados-naf/business/nomina-manual-split";

export type ManualAllocationContractInfo = {
  id: string;
  licitacionNo: string;
  client: string;
  company: string;
};

export type ManualAllocationRow = {
  id: string;
  contractId: string;
  devengado: number;
  deducciones: number;
  neto: number;
  notes: string | null;
  contract: ManualAllocationContractInfo;
};

export function manualAllocationEmployeeKey(
  noCia: string,
  noEmple: string,
  codPla: string,
): string {
  return `${noCia}|${noEmple}|${codPla}`;
}

export function calendarDateKey(value: Date | string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

export function parsePeriodDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return date;
}

export function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

export function hasAsistenciaSalaryAllocation(
  contratosAsistencia: Array<{ devengado?: number }>,
): boolean {
  return contratosAsistencia.some((row) => (row.devengado ?? 0) > 0);
}

export function manualRowsToContratosAsistencia(
  manualRows: ManualAllocationRow[],
  employeeDevengado: number,
): NafAsistenciaContratoAsignado[] {
  if (manualRows.length === 0) return [];

  return manualRows.map((row) => ({
    noContrato: row.contract.licitacionNo,
    contratoNormalizado: null,
    contractId: row.contractId,
    licitacionNo: row.contract.licitacionNo,
    client: row.contract.client,
    dias: 0,
    roles: 0,
    ubicaciones: 0,
    diasConMarca: 0,
    marcas: 0,
    horas: 0,
    pagoRol: 0,
    participacion:
      employeeDevengado > 0 ? row.devengado / employeeDevengado : 1 / manualRows.length,
    devengado: row.devengado,
    deducciones: row.deducciones,
    neto: row.neto,
  }));
}

export type ManualAllocationLineInput = {
  contractId: string;
  devengado: number;
};

export function buildManualAllocationAmounts(
  lines: ManualAllocationLineInput[],
  totalDevengado: number,
  totalDeducciones: number,
  totalNeto: number,
): Array<{ contractId: string; devengado: number; deducciones: number; neto: number }> {
  const weights = lines.map((line) => line.devengado);
  const devengadoParts = splitAmount(totalDevengado, weights);
  const deduccionesParts = splitAmount(totalDeducciones, weights);
  const netoParts = splitAmount(totalNeto, weights);

  return lines.map((line, index) => ({
    contractId: line.contractId,
    devengado: devengadoParts[index] ?? 0,
    deducciones: deduccionesParts[index] ?? 0,
    neto: netoParts[index] ?? 0,
  }));
}

export function validateManualAllocationTotals(
  lines: Array<{ devengado: number }>,
  expectedDevengado: number,
  tolerance = 0.02,
): void {
  const sum = lines.reduce((acc, line) => acc + line.devengado, 0);
  if (Math.abs(sum - expectedDevengado) > tolerance) {
    throw new Error(
      `La suma de devengado (${sum.toFixed(2)}) debe coincidir con el salario del empleado (${expectedDevengado.toFixed(2)})`,
    );
  }
}

export function applyManualAllocationsToEmpleadoRow<
  T extends {
    noCia: string;
    noEmple: string;
    codPla: string;
    devengado: number;
    contratosAsistencia: NafAsistenciaContratoAsignado[];
    contratosAsistenciaCount: number;
  },
>(
  row: T,
  manualByEmployeeKey: Map<string, ManualAllocationRow[]>,
): T {
  if (hasAsistenciaSalaryAllocation(row.contratosAsistencia)) {
    return row;
  }

  const key = manualAllocationEmployeeKey(row.noCia, row.noEmple, row.codPla);
  const manualRows = manualByEmployeeKey.get(key);
  if (!manualRows?.length) {
    return row;
  }

  const contratosAsistencia = manualRowsToContratosAsistencia(manualRows, row.devengado);
  return {
    ...row,
    contratosAsistencia,
    contratosAsistenciaCount: contratosAsistencia.length,
  };
}
