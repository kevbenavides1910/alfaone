import type { NafAsistenciaContratoAsignado } from "@/modules/empleados-naf/business/nomina-asistencia-format";
import {
  applyCargasSociales,
  weightedCargasSocialesPct,
  type CargasSocialesMontos,
} from "@/modules/empleados-naf/business/cargas-sociales-calc";
import type { NominaAsistenciaDetalleRow } from "@/modules/empleados-naf/business/nomina-asistencia-allocate";
import type {
  NafNominaDetalleResult,
  NafNominaEmpleadoRow,
  NafNominaEmpresaResumen,
} from "@/modules/empleados-naf/services/list-nomina";
import type { NafNominaContratoResumen } from "@/modules/empleados-naf/services/nomina-contract-resolve";

type RowWithDevengado = { devengado: number };

function enrichRow<T extends RowWithDevengado>(row: T, pct: number): T & CargasSocialesMontos {
  return { ...row, ...applyCargasSociales(row.devengado, pct) };
}

export function enrichNominaDetalleWithCargasSociales(
  detalle: NafNominaDetalleResult,
  pctByNoCia: Map<string, number>,
): NafNominaDetalleResult {
  const empleados = detalle.empleados.map((row) => {
    const pct = pctByNoCia.get(row.noCia) ?? 0;
    const contratosAsistencia: Array<NafAsistenciaContratoAsignado & CargasSocialesMontos> =
      row.contratosAsistencia.map((contrato) => enrichRow(contrato, pct));
    return {
      ...enrichRow(row, pct),
      contratosAsistencia,
    };
  });

  const porEmpresa: Array<NafNominaEmpresaResumen & CargasSocialesMontos> = detalle.porEmpresa.map((row) =>
    enrichRow(row, pctByNoCia.get(row.noCia) ?? 0),
  );

  const asistenciaDetalle: Array<NominaAsistenciaDetalleRow & CargasSocialesMontos> =
    detalle.asistenciaDetalle.map((row) => enrichRow(row, pctByNoCia.get(row.noCia) ?? 0));

  const contratoAgg = new Map<
    string,
    { cargasSocialesMonto: number; brutoConCargasSociales: number }
  >();

  for (const empleado of empleados) {
    for (const contrato of empleado.contratosAsistencia) {
      const key = contrato.contractId ?? contrato.contratoNormalizado ?? contrato.noContrato;
      const current = contratoAgg.get(key) ?? {
        cargasSocialesMonto: 0,
        brutoConCargasSociales: 0,
      };
      current.cargasSocialesMonto += contrato.cargasSocialesMonto;
      current.brutoConCargasSociales += contrato.brutoConCargasSociales;
      contratoAgg.set(key, current);
    }
  }

  const porContrato: Array<NafNominaContratoResumen & CargasSocialesMontos> = detalle.porContrato.map((row) => {
    const key = row.contractId ?? row.contratoNormalizado ?? row.contratoRrhh;
    const aggregated = contratoAgg.get(key);
    if (!aggregated) {
      return enrichRow(row, 0);
    }
    return {
      ...row,
      cargasSocialesPct: weightedCargasSocialesPct(row.devengado, aggregated.cargasSocialesMonto),
      cargasSocialesMonto: aggregated.cargasSocialesMonto,
      brutoConCargasSociales: aggregated.brutoConCargasSociales,
    };
  });

  const totalesCargas = porEmpresa.reduce(
    (acc, row) => ({
      cargasSocialesMonto: acc.cargasSocialesMonto + row.cargasSocialesMonto,
      brutoConCargasSociales: acc.brutoConCargasSociales + row.brutoConCargasSociales,
    }),
    { cargasSocialesMonto: 0, brutoConCargasSociales: 0 },
  );

  return {
    ...detalle,
    porEmpresa,
    porContrato,
    asistenciaDetalle,
    empleados,
    totales: {
      ...detalle.totales,
      cargasSocialesPct: weightedCargasSocialesPct(
        detalle.totales.devengado,
        totalesCargas.cargasSocialesMonto,
      ),
      ...totalesCargas,
    },
  };
}
