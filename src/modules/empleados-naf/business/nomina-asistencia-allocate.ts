import type { NafAsistenciaContratoRow } from "@/modules/empleados-naf/business/nomina-asistencia-format";
import { asistenciaAllocationWeight } from "@/modules/empleados-naf/business/nomina-asistencia-hours";
import type { NafNominaContratoResumen } from "@/modules/empleados-naf/services/nomina-contract-resolve";

export type NafAsistenciaContratoAsignado = NafAsistenciaContratoRow & {
  participacion: number;
  devengado: number;
  deducciones: number;
  neto: number;
};

export type NominaEmpleadoAsistenciaInput = {
  sourceKey: string;
  noCia: string;
  noEmple: string;
  nombre: string | null;
  companyLabel: string;
  contratoRrhh: string | null;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  devengado: number;
  deducciones: number;
  neto: number;
  contratosAsistencia: NafAsistenciaContratoRow[];
};

export type NominaAsistenciaDetalleRow = {
  noCia: string;
  companyLabel: string;
  noEmple: string;
  nombre: string | null;
  noContrato: string;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  marcas: number;
  dias: number;
  diasConMarca: number;
  horas: number;
  pagoRol: number;
  participacion: number;
  devengado: number;
  deducciones: number;
  neto: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function splitAmount(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) {
    return [];
  }

  let assigned = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return roundMoney(total - assigned);
    }
    const share = roundMoney((total * weight) / weightSum);
    assigned += share;
    return share;
  });
}

function contratosConPesoAsistencia(
  contratos: NafAsistenciaContratoRow[],
): NafAsistenciaContratoRow[] {
  return contratos.filter((row) => asistenciaAllocationWeight(row) > 0);
}

export function allocateSalaryByAsistenciaContratos(
  contratos: NafAsistenciaContratoRow[],
  devengado: number,
  deducciones: number,
  neto: number,
): NafAsistenciaContratoAsignado[] {
  const weighted = contratosConPesoAsistencia(contratos);
  if (weighted.length === 0) return [];

  const weights = weighted.map((row) => asistenciaAllocationWeight(row));
  const devengadoParts = splitAmount(devengado, weights);
  if (devengadoParts.length === 0) return [];

  const deduccionesParts = splitAmount(deducciones, weights);
  const netoParts = splitAmount(neto, weights);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  return weighted.map((row, index) => ({
    ...row,
    participacion: weightSum > 0 ? weights[index]! / weightSum : 1 / weighted.length,
    devengado: devengadoParts[index] ?? 0,
    deducciones: deduccionesParts[index] ?? 0,
    neto: netoParts[index] ?? 0,
  }));
}

export function enrichEmpleadoAsistenciaAsignada<T extends NominaEmpleadoAsistenciaInput>(
  row: T,
): T & {
  marcasAsistenciaTotal: number;
  horasAsistenciaTotal: number;
  pagoRolAsistenciaTotal: number;
  contratosAsistencia: NafAsistenciaContratoAsignado[];
} {
  const baseContratos = contratosConPesoAsistencia(row.contratosAsistencia);

  const contratosAsistencia = allocateSalaryByAsistenciaContratos(
    baseContratos,
    row.devengado,
    row.deducciones,
    row.neto,
  );
  const marcasAsistenciaTotal = row.contratosAsistencia.reduce(
    (sum, contrato) => sum + (contrato.marcas || contrato.dias),
    0,
  );
  const horasAsistenciaTotal = row.contratosAsistencia.reduce(
    (sum, contrato) => sum + (contrato.horas || 0),
    0,
  );
  const pagoRolAsistenciaTotal = row.contratosAsistencia.reduce(
    (sum, contrato) => sum + (contrato.pagoRol || 0),
    0,
  );

  return {
    ...row,
    marcasAsistenciaTotal,
    horasAsistenciaTotal,
    pagoRolAsistenciaTotal,
    contratosAsistencia,
  };
}

export function buildAsistenciaDetalleRows(
  empleados: Array<
    NominaEmpleadoAsistenciaInput & {
      contratosAsistencia: NafAsistenciaContratoAsignado[];
    }
  >,
): NominaAsistenciaDetalleRow[] {
  const rows: NominaAsistenciaDetalleRow[] = [];

  for (const empleado of empleados) {
    for (const contrato of empleado.contratosAsistencia) {
      rows.push({
        noCia: empleado.noCia,
        companyLabel: empleado.companyLabel,
        noEmple: empleado.noEmple,
        nombre: empleado.nombre,
        noContrato: contrato.noContrato,
        contratoNormalizado: contrato.contratoNormalizado,
        contractId: contrato.contractId,
        licitacionNo: contrato.licitacionNo,
        client: contrato.client,
        marcas: contrato.marcas || contrato.dias,
        dias: contrato.marcas || contrato.dias,
        diasConMarca: contrato.diasConMarca,
        horas: contrato.horas || 0,
        pagoRol: contrato.pagoRol || 0,
        participacion: contrato.participacion,
        devengado: contrato.devengado,
        deducciones: contrato.deducciones,
        neto: contrato.neto,
      });
    }
  }

  return rows.sort((a, b) => {
    const byEmpresa = a.noCia.localeCompare(b.noCia);
    if (byEmpresa !== 0) return byEmpresa;
    const byEmpleado = a.noEmple.localeCompare(b.noEmple);
    if (byEmpleado !== 0) return byEmpleado;
    return b.pagoRol - a.pagoRol || b.horas - a.horas || b.marcas - a.marcas;
  });
}

export function aggregateNominaByAsistenciaContrato(
  empleados: Array<{
    sourceKey: string;
    devengado?: number;
    deducciones?: number;
    neto?: number;
    contratosAsistencia: NafAsistenciaContratoAsignado[];
  }>,
): NafNominaContratoResumen[] {
  const agg = new Map<
    string,
    NafNominaContratoResumen & {
      empleadoIds: Set<string>;
      dias: number;
      horas: number;
      pagoRol: number;
    }
  >();
  const sinAsistenciaBucket = {
    empleadoIds: new Set<string>(),
    devengado: 0,
    deducciones: 0,
    neto: 0,
  };

  for (const empleado of empleados) {
    if (empleado.contratosAsistencia.length === 0) {
      sinAsistenciaBucket.empleadoIds.add(empleado.sourceKey);
      sinAsistenciaBucket.devengado += empleado.devengado ?? 0;
      sinAsistenciaBucket.deducciones += empleado.deducciones ?? 0;
      sinAsistenciaBucket.neto += empleado.neto ?? 0;
      continue;
    }

    for (const contrato of empleado.contratosAsistencia) {
      const key = contrato.contractId ?? contrato.contratoNormalizado ?? contrato.noContrato;
      const current = agg.get(key) ?? {
        contratoRrhh: contrato.noContrato,
        contratoNormalizado: contrato.contratoNormalizado,
        contractId: contrato.contractId,
        licitacionNo: contrato.licitacionNo,
        client: contrato.client,
        empleados: 0,
        devengado: 0,
        deducciones: 0,
        neto: 0,
        sinVinculo: !contrato.contractId,
        clasificacion: "directa" as const,
        empleadoIds: new Set<string>(),
        dias: 0,
        horas: 0,
        pagoRol: 0,
      };

      current.empleadoIds.add(empleado.sourceKey);
      current.empleados = current.empleadoIds.size;
      current.devengado += contrato.devengado;
      current.deducciones += contrato.deducciones;
      current.neto += contrato.neto;
      current.dias += contrato.marcas || contrato.dias;
      current.horas += contrato.horas || 0;
      current.pagoRol += contrato.pagoRol || 0;
      if (contrato.contractId) current.sinVinculo = false;
      agg.set(key, current);
    }
  }

  const result = Array.from(agg.values())
    .map(({ empleadoIds: _empleadoIds, ...row }) => row)
    .sort((a, b) => b.neto - a.neto);

  if (sinAsistenciaBucket.empleadoIds.size > 0) {
    result.push({
      contratoRrhh: "SIN-ASISTENCIA",
      contratoNormalizado: null,
      contractId: null,
      licitacionNo: null,
      client: "Empleados sin registro de asistencia en la quincena",
      empleados: sinAsistenciaBucket.empleadoIds.size,
      dias: 0,
      horas: 0,
      pagoRol: 0,
      devengado: sinAsistenciaBucket.devengado,
      deducciones: sinAsistenciaBucket.deducciones,
      neto: sinAsistenciaBucket.neto,
      sinVinculo: true,
      clasificacion: "inferida",
    });
  }

  return result;
}
