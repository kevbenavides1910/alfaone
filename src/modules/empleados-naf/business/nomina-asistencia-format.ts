export type NafAsistenciaContratoRow = {
  noContrato: string;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  dias: number;
  roles: number;
  ubicaciones: number;
  diasConMarca: number;
  /** Alias semántico: en NAF cada fila de asistencia es una marca/turno. */
  marcas: number;
  /** Horas trabajadas (suma de turnos parseados desde HORARIO). */
  horas: number;
  /** Suma de SALARIO+EXTRAS+FERIADO del rol (AROPPR) en los días del contrato. */
  pagoRol: number;
};

export type NafAsistenciaContratoAsignado = NafAsistenciaContratoRow & {
  participacion: number;
  devengado: number;
  deducciones: number;
  neto: number;
};

export function formatAsistenciaContratosLabel(
  contratos: Array<
    Pick<
      NafAsistenciaContratoRow,
      "client" | "licitacionNo" | "noContrato" | "dias" | "marcas" | "horas" | "pagoRol"
    >
  >,
): string {
  if (contratos.length === 0) return "";
  return contratos
    .map((row) => {
      const label = row.client ?? row.licitacionNo ?? row.noContrato;
      const horas = row.horas > 0 ? `${row.horas}h` : null;
      const marcas = `${row.marcas ?? row.dias}m`;
      return `${label} (${horas ?? marcas})`;
    })
    .join(" · ");
}

export function formatParticipacion(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
